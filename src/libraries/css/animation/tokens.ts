/**
 * The names this engine owns and the timing tokens: their defaults, the `:root` sheet that
 * declares them with its reduced-motion block, and the `var()` reads every other file builds on.
 * The guaranteed names are docs/decisions/engines-read-tokens-never-redeclare-them.md; `attributes` is the hook timeline() selects on.
 */
import { css, type StyleResult } from '../templates/index.ts';
import { block, declaration, fail, known, text } from './text.ts';

export const durationTokens = ['instant', 'fast', 'base', 'slow'] as const;
export const easeTokens = ['linear', 'in', 'out', 'in-out'] as const;
export type DurationToken = (typeof durationTokens)[number];
export type EaseToken = (typeof easeTokens)[number];

/** A value read per animated element, declared on `:root` with a default: `--anim-<knob>`. */
export type Knob = 'distance' | 'scale';
export const knobs: readonly Knob[] = Object.freeze(['distance', 'scale']);

/** The properties outside the two token prefixes: the stagger step, the index and the knobs. */
export const names = {
  stagger: '--stagger',
  index: '--anim-index',
  distance: '--anim-distance',
  scale: '--anim-scale',
} as const;

/** The attribute hooks, keyed by word: a consumer reads `attributes.anim`, never the literal. */
export const attributes: { readonly anim: 'data-anim' } = Object.freeze({ anim: 'data-anim' });

export const durationProperty = (token: string): string => `--duration-${token}`;
export const easeProperty = (token: string): string => `--ease-${token}`;

export interface AnimationOptions {
  /** The selector the tokens are declared on; `:root` by default. */
  selector?: string;
  /** Token → time. The four guaranteed are always present from `defaults`; extras are allowed (`slower: '600ms'`) and are 0ms under reduced motion too. */
  durations?: Partial<Record<DurationToken, string>> & Record<string, string>;
  /** Token → easing: a keyword, `cubic-bezier(…)` or `linear(…)`. */
  eases?: Partial<Record<EaseToken, string>> & Record<string, string>;
  /** The delay step between staggered siblings. */
  stagger?: string;
  /** How far a slide travels and half of how far a shake swings. */
  distance?: string;
  /** Where scale-in starts and scale-out ends. */
  scale?: string;
}

export const defaults = Object.freeze({
  durations: Object.freeze({ instant: '50ms', fast: '150ms', base: '250ms', slow: '400ms' }),
  eases: Object.freeze({ linear: 'linear', in: 'ease-in', out: 'ease-out', 'in-out': 'ease-in-out' }),
  stagger: '40ms',
  distance: '1rem',
  scale: '0.95',
});

const optionKeys = ['selector', 'durations', 'eases', 'stagger', 'distance', 'scale'] as const;

/**
 * The sheet: a `:root` block declaring every token, the index and the knobs; then the reduced-motion
 * block zeroing every `--duration-*` (extras included) and `--stagger`. A reader of a duration needs
 * no rule of its own; an infinite keyframe stops (a zero iteration duration is a zero active duration,
 * whatever the count). Document level: the shell applies it to `document`.
 */
export function tokens(options: AnimationOptions = {}): StyleResult {
  known('tokens', 'option', options, optionKeys);
  const selector = text('tokens', 'selector', or(options.selector, ':root'));
  const durations = merge('durations', defaults.durations, options.durations);
  const eases = merge('eases', defaults.eases, options.eases);
  const declared = [
    ...Object.entries(durations).map(([token, value]) => declaration(durationProperty(token), value)),
    ...Object.entries(eases).map(([token, value]) => declaration(easeProperty(token), value)),
    declaration(names.stagger, or(options.stagger, defaults.stagger)),
    declaration(names.index, 0),
    ...knobs.map((knob) => declaration(names[knob], or(options[knob], defaults[knob]))),
  ];
  const still = [...Object.keys(durations).map((token) => declaration(durationProperty(token), '0ms')), declaration(names.stagger, '0ms')];
  return css`${block(selector, declared.join('\n')) + block('@media (prefers-reduced-motion: reduce)', block(selector, still.join('\n')))}`;
}

/** `var(--duration-fast, 150ms)`: the fallback is the default when the token is guaranteed; the author's own token has none. */
export function duration(token: DurationToken | (string & {})): string {
  return read(durationProperty(token), (defaults.durations as Record<string, string>)[token]);
}

/** `var(--ease-out, ease-out)`, as duration(). */
export function ease(token: EaseToken | (string & {})): string {
  return read(easeProperty(token), (defaults.eases as Record<string, string>)[token]);
}

/** `var(--anim-distance, 1rem)`: a knob, read where the keyframe applies, with its default as the fallback. */
export function knob(name: Knob): string {
  return read(names[name], defaults[name]);
}

/** `var(--anim-index, 0)`. */
export const staggerIndex = (): string => read(names.index, '0');

/** `var(--stagger, 40ms)`. */
export const staggerStep = (): string => read(names.stagger, defaults.stagger);

function read(property: string, fallback: string | undefined): string {
  return fallback === undefined ? `var(${property})` : `var(${property}, ${fallback})`;
}

/** An option left out (undefined) is its default; anything else, null included, reaches the text guard in declaration(). */
const or = (given: unknown, fallback: unknown): unknown => (given === undefined ? fallback : given);

/** The defaults with the author's entries over them; an entry given as undefined leaves the default alone. Values are checked where they are declared. */
function merge(option: string, base: Readonly<Record<string, string>>, over: Record<string, unknown> | undefined): Record<string, unknown> {
  if (over === undefined) return { ...base };
  if (typeof over !== 'object' || over === null || Array.isArray(over)) fail('tokens', `${option} is not an object`, `give token → value, like { fast: '100ms' }`);
  const merged: Record<string, unknown> = { ...base };
  for (const [token, value] of Object.entries(over)) if (value !== undefined) merged[token] = value;
  return merged;
}
