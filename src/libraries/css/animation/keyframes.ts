/**
 * The keyframe vocabulary as data: each keyframe's frames, the knobs it reads, and
 * its natural duration, ease and iteration count. `keyframes`, keyframeRules() and a
 * timeline step's omitted fields all derive from this one record, so they cannot drift.
 *
 * Entrances are from-only: the element's own opacity, translate or scale is the end,
 * so `fill: both` pins nothing over its cascade afterwards. fade-out and scale-out are
 * the to-only exits; any entrance is an exit with `direction: 'reverse'` too. Frames write the individual
 * translate/scale/rotate properties, never transform, so two keyframes on one element
 * compose and the element's own transform survives. Flash is Effects' transition.
 *
 * Every keyframe carries `again: true`, so every one is emitted twice and every one can be
 * restarted by a step's `restart` count (round 4). A CSS animation replays only when the name
 * changes, and an element that stays in the DOM — a toast whose message is replaced, a row
 * re-used by the morph — has no other way to play its entrance a second time. Round 1 gave the
 * twin to shake and pulse alone and the first composite that wanted one (Semantics' toast)
 * hit the wall; the flag stays on the interface, optional, so an entry may still decline it.
 */
import { css, type StyleResult } from '../templates/index.ts';
import { block, declaration } from './text.ts';
import { type DurationToken, type EaseToken, type Knob, knob } from './tokens.ts';

export interface Keyframe {
  /** Defaults for a timeline step that leaves them out. */
  readonly duration: DurationToken;
  readonly ease: EaseToken;
  readonly iterations: number | 'infinite';
  /** The `--anim-*` knobs the frames read. */
  readonly knobs: readonly Knob[];
  /** Frame selector → declarations. */
  readonly frames: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Emitted twice, as anim-<name> and anim-<name>-again, so a step's `restart` count flips the name and the browser replays it. True on every entry today. */
  readonly again?: true;
}

const distance = knob('distance');
const back = `calc(-1 * ${distance})`;

export const vocabulary = {
  'fade-in': { duration: 'fast', ease: 'out', iterations: 1, knobs: [], frames: { from: { opacity: '0' } }, again: true },
  'fade-out': { duration: 'fast', ease: 'in', iterations: 1, knobs: [], frames: { to: { opacity: '0' } }, again: true },
  'slide-up': { duration: 'base', ease: 'out', iterations: 1, knobs: ['distance'], frames: { from: { translate: `0 ${distance}`, opacity: '0' } }, again: true },
  'slide-down': { duration: 'base', ease: 'out', iterations: 1, knobs: ['distance'], frames: { from: { translate: `0 ${back}`, opacity: '0' } }, again: true },
  'slide-left': { duration: 'base', ease: 'out', iterations: 1, knobs: ['distance'], frames: { from: { translate: `${distance} 0`, opacity: '0' } }, again: true },
  'slide-right': { duration: 'base', ease: 'out', iterations: 1, knobs: ['distance'], frames: { from: { translate: `${back} 0`, opacity: '0' } }, again: true },
  'scale-in': { duration: 'base', ease: 'out', iterations: 1, knobs: ['scale'], frames: { from: { scale: knob('scale'), opacity: '0' } }, again: true },
  'scale-out': { duration: 'base', ease: 'in', iterations: 1, knobs: ['scale'], frames: { to: { scale: knob('scale'), opacity: '0' } }, again: true },
  spin: { duration: 'slow', ease: 'linear', iterations: 'infinite', knobs: [], frames: { to: { rotate: '1turn' } }, again: true },
  pulse: { duration: 'slow', ease: 'in-out', iterations: 'infinite', knobs: [], frames: { '50%': { opacity: '0.5' } }, again: true },
  shake: {
    duration: 'fast',
    ease: 'linear',
    iterations: 1,
    knobs: ['distance'],
    frames: { '10%, 50%, 90%': { translate: `calc(${distance} * -0.5) 0` }, '30%, 70%': { translate: `calc(${distance} * 0.5) 0` } },
    again: true,
  },
} as const satisfies Record<string, Keyframe>;

/** What a step may say: the bare name. */
export type KeyframeName = keyof typeof vocabulary;
export const keyframeNames = Object.keys(vocabulary) as readonly KeyframeName[];

type Restartable = { [K in KeyframeName]: (typeof vocabulary)[K] extends { readonly again: true } ? K : never }[KeyframeName];
/** What the text says: `anim-<name>`, and `anim-<name>-again` for every restartable name. */
export type KeyframeIdent = `anim-${KeyframeName}` | `anim-${Restartable}-again`;

/** The one place a name becomes an ident: ident('shake') → 'anim-shake'; ident('shake', true) → 'anim-shake-again'. */
export function ident(name: KeyframeName, again = false): KeyframeIdent {
  return `anim-${name}${again ? '-again' : ''}` as KeyframeIdent;
}

/** The vocabulary entry, widened to its interface. */
export const entry = (name: KeyframeName): Keyframe => vocabulary[name];

/** Every ident keyframeRules() emits, in order, the -again pairs beside their base. */
export const keyframes: readonly KeyframeIdent[] = Object.freeze(
  keyframeNames.flatMap((name) => (entry(name).again ? [ident(name), ident(name, true)] : [ident(name)])),
);

/** One `@keyframes` block per ident in `keyframes`: the only emitter of `@keyframes` in this engine. Document level. */
export function keyframeRules(): StyleResult {
  const rules = keyframeNames
    .map((name) => {
      const { frames, again } = entry(name);
      const body = Object.entries(frames)
        .map(([selector, declared]) => block(selector, Object.entries(declared).map(([property, value]) => declaration(property, value)).join('\n')))
        .join('');
      const rule = (id: KeyframeIdent) => block(`@keyframes ${id}`, body);
      return again ? rule(ident(name)) + rule(ident(name, true)) : rule(ident(name));
    })
    .join('');
  return css`${rules}`;
}
