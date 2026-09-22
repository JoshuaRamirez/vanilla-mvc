/**
 * Timelines: an ordered list of steps compiled to one `animation` shorthand value,
 * native one-to-one. A step with no `after` is a native list entry (parallel, from
 * the timeline's origin); `after: 'previous'` sums the previous step's end into the
 * delay as a calc() of the same tokens. Every delay starts from the origin
 * `min(var(--anim-index, 0), cap) * var(--stagger, 40ms)`, so every compiled value is
 * staggerable by setting --anim-index and nothing else, and a hand-set index waits at
 * most `cap` steps.
 *
 *   origin  = min(index, cap) × stagger
 *   offset  = (after === 'previous' ? end of the previous step : 0) + delay
 *   end     = offset + duration × iterations          (none when iterations is infinite)
 *   total   = origin + end, or origin + max(ends) when ends are parallel
 */
import { type KeyframeName, entry, ident, keyframeNames, vocabulary } from './keyframes.ts';
import { css, type StyleResult } from '../templates/index.ts';
import { block, declaration, fail, known, text } from './text.ts';
import { type DurationToken, type EaseToken, attributes, duration, durationTokens, ease, easeTokens, staggerIndex, staggerStep } from './tokens.ts';

export interface TimelineStep {
  keyframe: KeyframeName;
  /** A token only, so every step respects reduced motion by construction. Default: the keyframe's own. */
  duration?: DurationToken;
  /** Default: the keyframe's own. */
  ease?: EaseToken;
  /** A number is milliseconds; a token is `var(--duration-<token>)`. Added to the start. Default 0. */
  delay?: number | DurationToken;
  /** Absent: from the timeline's origin, as the native list is (parallel). 'previous': after the previous step ends. Ignored on the first step. */
  after?: 'previous';
  /** Default: the keyframe's own (spin and pulse are infinite). */
  iterations?: number | 'infinite';
  /** Default 'normal'; 'reverse' is how an entrance becomes an exit. */
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  /** Default 'both': a delayed entrance is already hidden while it waits. */
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
  /** shake and pulse only: even → anim-<name>, odd → anim-<name>-again. A changed name is what the browser replays on, so a controller re-triggers by counting. */
  restart?: number;
}

/** What animate() takes beside the keyframe. */
export type StepOptions = Omit<TimelineStep, 'keyframe' | 'after'>;

export interface Timeline {
  /** A kebab-case identifier; timeline() selects `[data-anim="<name>"]`. */
  name: string;
  /** A bare keyframe name is a step with the keyframe's own defaults. */
  steps: readonly (TimelineStep | KeyframeName)[];
  /** The most stagger steps any element waits, whatever its --anim-index; match your stagger() count. Default 10. */
  cap?: number;
}

/** The default cap on the stagger index when a timeline names none. */
export const defaultCap = 10;

const timelineKeys = ['name', 'steps', 'cap'] as const;
const stepKeys = ['keyframe', 'duration', 'ease', 'delay', 'after', 'iterations', 'direction', 'fill', 'restart'] as const;
const directions = ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const;
const fills = ['none', 'forwards', 'backwards', 'both'] as const;

/** Ready-made timelines; compile them at module top level: `const enter = animation(timelines.enter)`. */
export const timelines = Object.freeze({
  /** fade-in with slide-up, in parallel. */
  enter: Object.freeze({ name: 'enter', steps: Object.freeze(['fade-in', 'slide-up'] as const) }),
  /** fade-out, fast. */
  leave: Object.freeze({ name: 'leave', steps: Object.freeze([{ keyframe: 'fade-out', duration: 'fast' }] as const) }),
  /** shake, then two pulses. */
  attention: Object.freeze({ name: 'attention', steps: Object.freeze(['shake', { keyframe: 'pulse', after: 'previous', iterations: 2 }] as const) }),
}) satisfies Readonly<Record<string, Timeline>>;

/** The `animation` shorthand value: one entry per step, seven fields in canonical order. The author owns the selector. */
export function animation(t: Timeline | readonly (TimelineStep | KeyframeName)[]): string {
  return compile(t, 'animation').entries.join(', ');
}

/** One-step sugar: animate('spin') is animation(['spin']). */
export function animate(keyframe: KeyframeName, options: StepOptions = {}): string {
  return animation([{ ...options, keyframe }]);
}

/** The rule, a StyleResult for statement start: `[data-anim="<name>"] { animation: …; }` (attributes.anim), or on the selector given. */
export function timeline(t: Timeline, selector?: string): StyleResult {
  known('timeline', 'timeline field', t, timelineKeys);
  const name = text('timeline', 'name', t.name);
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('timeline', `name '${name}' is not a kebab-case identifier`, "write it like 'row-enter'");
  const on = selector === undefined ? `[${attributes.anim}="${name}"]` : text('timeline', 'selector', selector);
  return css`${block(on, declaration('animation', animation(t)))}`;
}

/** When the timeline ends, as a CSS <time>: calc(origin + end), or calc(origin + max(…)) when ends are parallel. Infinite steps have no end. */
export function total(t: Timeline | readonly (TimelineStep | KeyframeName)[]): string {
  const { origin, ends } = compile(t, 'total');
  const rendered = [...new Set(ends.map((end) => terms(end).join(' + ') || '0ms'))];
  if (rendered.length === 0) return `calc(${origin})`;
  if (rendered.length === 1) return `calc(${origin} + ${rendered[0]})`;
  return `calc(${origin} + max(${rendered.join(', ')}))`;
}

// ---- The compiler ----

/** A sum of duration tokens and literal milliseconds, kept symbolic so it renders as a calc() of the same var()s. */
interface Sum {
  readonly counts: ReadonlyMap<DurationToken, number>;
  readonly ms: number;
}

const zero: Sum = { counts: new Map(), ms: 0 };

function plus(sum: Sum, token: DurationToken, times: number): Sum {
  if (times === 0) return sum;
  const counts = new Map(sum.counts);
  counts.set(token, (counts.get(token) ?? 0) + times);
  return { counts, ms: sum.ms };
}

const plusMs = (sum: Sum, ms: number): Sum => (ms === 0 ? sum : { counts: sum.counts, ms: sum.ms + ms });

/** The sum as calc() terms, in token order: ['var(--duration-base, 250ms) * 2', '100ms']; none when zero. */
function terms(sum: Sum): string[] {
  const out = durationTokens.filter((token) => sum.counts.has(token)).map((token) => (sum.counts.get(token) === 1 ? duration(token) : `${duration(token)} * ${sum.counts.get(token)}`));
  if (sum.ms !== 0) out.push(`${sum.ms}ms`);
  return out;
}

function compile(t: Timeline | readonly (TimelineStep | KeyframeName)[], fn: string): { origin: string; entries: string[]; ends: Sum[] } {
  if (!Array.isArray(t)) known(fn, 'timeline field', t, timelineKeys);
  const steps = Array.isArray(t) ? (t as readonly (TimelineStep | KeyframeName)[]) : (t as Timeline).steps;
  const cap = Array.isArray(t) ? defaultCap : ((t as Timeline).cap ?? defaultCap);
  if (!Array.isArray(steps) || steps.length === 0) fail(fn, 'no steps', "give at least one keyframe, e.g. ['fade-in']");
  if (!Number.isInteger(cap) || cap < 1) fail(fn, `cap ${String(cap)} is not an integer of 1 or more`, 'give the stagger() count, or leave it out for 10');

  const origin = `min(${staggerIndex()}, ${cap}) * ${staggerStep()}`;
  const entries: string[] = [];
  const ends: Sum[] = [];
  let previous: Sum | 'infinite' = zero;
  steps.forEach((given, i) => {
    const k = i + 1;
    if (typeof given !== 'string') known(fn, `step ${k} field`, given, stepKeys);
    const step: TimelineStep = typeof given === 'string' ? { keyframe: given } : given;
    const name = knownKeyframe(fn, k, step.keyframe);
    const own = entry(name);
    const durationToken = oneOf(fn, `step ${k} duration`, step.duration ?? own.duration, durationTokens);
    const easeToken = oneOf(fn, `step ${k} ease`, step.ease ?? own.ease, easeTokens);
    const iterations = step.iterations ?? own.iterations;
    if (iterations !== 'infinite' && !(typeof iterations === 'number' && Number.isFinite(iterations) && iterations >= 0)) {
      fail(fn, `step ${k} iterations ${String(iterations)} is not a number of 0 or more`, "give a count, or 'infinite'");
    }
    const direction = oneOf(fn, `step ${k} direction`, step.direction ?? 'normal', directions);
    const fill = oneOf(fn, `step ${k} fill`, step.fill ?? 'both', fills);
    if (step.after !== undefined && step.after !== 'previous') fail(fn, `step ${k} after '${String(step.after)}' is not 'previous'`, "write after: 'previous', or leave it out to run from the origin");

    let start = zero;
    if (step.after === 'previous' && i > 0) {
      if (previous === 'infinite') fail(fn, `step ${k} waits for step ${k - 1}, which never ends`, 'drop after');
      start = previous;
    }
    if (step.delay !== undefined) {
      if (typeof step.delay === 'number') {
        if (!Number.isFinite(step.delay) || step.delay < 0) fail(fn, `step ${k} delay ${step.delay} is not a number of milliseconds`, "give milliseconds, or a token like 'fast'");
        start = plusMs(start, step.delay);
      } else start = plus(start, oneOf(fn, `step ${k} delay`, step.delay, durationTokens), 1);
    }
    const end: Sum | 'infinite' = iterations === 'infinite' ? 'infinite' : plus(start, durationToken, iterations);

    const delay = `calc(${[origin, ...terms(start)].join(' + ')})`;
    entries.push([ident(name, isAgain(fn, k, name, step.restart)), duration(durationToken), ease(easeToken), delay, String(iterations), direction, fill].join(' '));

    if (end !== 'infinite') {
      if (step.after === 'previous' && i > 0 && previous !== 'infinite') ends.splice(ends.indexOf(previous), 1);
      ends.push(end);
    }
    previous = end;
  });
  return { origin, entries, ends };
}

function knownKeyframe(fn: string, k: number, given: unknown): KeyframeName {
  if (typeof given === 'string' && given in vocabulary) return given as KeyframeName;
  const known = keyframeNames.join(', ');
  if (typeof given === 'string' && given.startsWith('anim-') && given.slice(5) in vocabulary) {
    fail(fn, `step ${k} keyframe '${given}' carries the anim- prefix`, `a step names the keyframe bare: '${given.slice(5)}' (the known names are ${known})`);
  }
  return fail(fn, `step ${k} keyframe '${String(given)}' is not one of ${known}`, 'pick one of them');
}

function isAgain(fn: string, k: number, name: KeyframeName, restart: number | undefined): boolean {
  if (restart === undefined) return false;
  if (!Number.isInteger(restart) || restart < 0) fail(fn, `step ${k} restart ${String(restart)} is not a count`, 'give the number of times the animation has been re-triggered, from 0');
  if (!entry(name).again) {
    const pairs = keyframeNames.filter((n) => entry(n).again).join(' and ');
    fail(fn, `step ${k} restart is on '${name}', which has no -again pair`, `restart is for ${pairs}; drop it here`);
  }
  return restart % 2 === 1;
}

function oneOf<T extends string>(fn: string, what: string, given: unknown, known: readonly T[]): T {
  if (typeof given === 'string' && (known as readonly string[]).includes(given)) return given as T;
  return fail(fn, `${what} '${String(given)}' is not one of ${known.join(', ')}`, 'pick one of them');
}
