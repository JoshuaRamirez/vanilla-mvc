/**
 * One home for every word: the effects, the states and their selectors, the restartable
 * one-shots, the knobs and their defaults, the attribute hook, the keyframes referenced,
 * and the foreign names this engine reads (docs/decisions/engines-read-tokens-never-redeclare-them.md). Nothing foreign is copied:
 * a duration or ease is Animation's `duration()`/`ease()` over its `defaults`, a keyframe's
 * pace and ident are its `vocabulary` and `ident()`, a shadow or the accent is Theme's
 * `shadowDefaults`/`defaults` under this engine's `var()`. Types derive from the arrays, so
 * a word cannot exist in one and not the other.
 */
import { type DurationToken, type EaseToken, type KeyframeName, defaults as animationDefaults, duration as animationDuration, ease as animationEase, ident, keyframes, vocabulary } from '../animation/index.ts';
import { type ShadowStep, defaults as themeDefaults, shadowDefaults } from '../theme/index.ts';
import { fail, read } from './text.ts';

export type { DurationToken, EaseToken, ShadowStep };

// ---- The hook ----

/** The attribute hooks, keyed by option word: a consumer reads `attributes.fx`, never the literal. */
export const attributes: { readonly fx: 'data-fx' } = Object.freeze({ fx: 'data-fx' });

// ---- Effects ----

export const effectNames = ['lift', 'dim', 'blur', 'frost', 'waiting', 'fade', 'fade-in', 'fade-out', 'pulse', 'shake', 'flash', 'elevation-0', 'elevation-1', 'elevation-2', 'elevation-3'] as const;
export type FxEffect = (typeof effectNames)[number];

/** The effects a state word may follow: `lift:hover`. The rest are always-on, or are the state. */
export const stateful = ['lift', 'dim', 'blur', 'frost', 'pulse'] as const;
export type Stateful = (typeof stateful)[number];

/** Restartable one-shots: odd/even count picks `shake` or `shake-again`, Animation's twin ident. Flash is a transition on a box the word creates, so it has no twin. */
export const restartable = ['shake'] as const;
export type Restartable = (typeof restartable)[number];

/** The words that write `animation`: two in one spec would leave one silently unplayed, so fx() refuses the pair. */
export const animated = ['fade-in', 'fade-out', 'pulse', 'shake'] as const;

/** The one sentence per effect the sheet's comment and the docs share. */
export const descriptions: Readonly<Record<FxEffect, string>> = Object.freeze({
  lift: 'rises by --fx-lift-rise and takes --fx-shadow-lifted; transform, not translate, so a shake keeps the lift',
  dim: 'opacity --fx-dim',
  blur: 'filter blur --fx-blur',
  frost: 'backdrop-filter blur --fx-frost, and a dialog frosts its ::backdrop too',
  waiting: 'the pointer says progress while the region works; no motion, no knob — the model says when (four sample components hand-wrote this before the word existed)',
  fade: 'the native hidden/open transition: [hidden], a closed dialog or popover fade out and back, first paint fades in, ::backdrop included; no keyframe',
  'fade-in': `plays ${ident('fade-in')} once on insertion; inert until Animation defines it`,
  'fade-out': `plays ${ident('fade-out')} once and holds its end; inert until Animation defines it`,
  pulse: `plays ${ident('pulse')} forever while the word is present; inert until Animation defines it`,
  shake: `plays ${ident('shake')} once; a count of arrivals from 1 flips shake (odd) and shake-again (even) so the browser replays — a controller sharing that counter with a timeline restart, which counts from 0, passes n - 1 there; inert until Animation defines it`,
  flash: 'an ::after box starts at --fx-flash-color and fades to transparent over --fx-flash-duration when the word arrives; no keyframe',
  'elevation-0': 'no shadow; a lift rises to --shadow-sm',
  'elevation-1': 'shadow --shadow-sm; a lift rises to --shadow-md',
  'elevation-2': 'shadow --shadow-md; a lift rises to --shadow-lg',
  'elevation-3': 'shadow --shadow-lg; a lift stays at --shadow-lg',
});

/**
 * The sentence for an effect, or for a `word:state` of a stateful effect — `describe('lift:selected')` names the
 * selector watched, `[aria-selected="true"]`, so a miss between the word and the attribute reads in one line.
 * Throws naming the set on an unknown word or state, or a state on an effect that takes none.
 */
export function describe(effect: FxEffect | `${Stateful}:${FxState}`): string {
  const at = typeof effect === 'string' ? effect.indexOf(':') : -1;
  if (at === -1) return descriptions[checkEffect('describe', effect)];
  const word = checkStateful('describe', checkEffect('describe', effect.slice(0, at)));
  const state = checkState('describe', effect.slice(at + 1));
  return `${descriptions[word]}, only while ${states[state]} matches`;
}

/** The effect must take a state: `lift`, `dim`, `blur`, `frost`, `pulse`. */
export function checkStateful(fn: string, effect: FxEffect): Stateful {
  if (!(stateful as readonly string[]).includes(effect)) fail(fn, `'${effect}' takes no state`, `the stateful effects are ${stateful.join(', ')}; the rest are always on, or are the state`);
  return effect as Stateful;
}

export function checkEffect(fn: string, given: unknown): FxEffect {
  if (typeof given !== 'string' || !(effectNames as readonly string[]).includes(given)) {
    fail(fn, `${JSON.stringify(given)} is not an effect`, `the effects are ${effectNames.join(', ')}`);
  }
  return given as FxEffect;
}

// ---- States ----

export const stateNames = ['hover', 'focus', 'active', 'open', 'expanded', 'selected', 'current', 'invalid', 'disabled', 'hidden', 'busy'] as const;
export type FxState = (typeof stateNames)[number];

/** State → the selector it is, appended to the hook. Each is (0,1,0), so every state row is (0,2,0). */
export const states: Readonly<Record<FxState, string>> = Object.freeze({
  hover: ':is(:hover, :focus-visible)',
  focus: ':focus-visible',
  active: ':active',
  open: ':is([open], :popover-open)',
  expanded: '[aria-expanded="true"]',
  selected: '[aria-selected="true"]',
  current: '[aria-current]',
  invalid: '[aria-invalid="true"]',
  disabled: ':is(:disabled, [aria-disabled="true"])',
  hidden: '[hidden]',
  busy: '[aria-busy="true"]',
});

export function checkState(fn: string, given: unknown): FxState {
  if (typeof given !== 'string' || !(stateNames as readonly string[]).includes(given)) {
    fail(fn, `${JSON.stringify(given)} is not a state`, `the states are ${stateNames.join(', ')}`);
  }
  return given as FxState;
}

/** The selector suffix for one or more states: `when('hover')` → `:is(:hover, :focus-visible)`; several → `:is(a, b)`. */
export function when(...given: FxState[]): string {
  if (given.length === 0) fail('when', 'no state was given', `give one or more of ${stateNames.join(', ')}`);
  const selectors = given.map((state) => states[checkState('when', state)]);
  if (selectors.length === 1) return selectors[0]!;
  const flat = selectors.map((selector) => (selector.startsWith(':is(') ? selector.slice(4, -1) : selector));
  return `:is(${flat.join(', ')})`;
}

// ---- Foreign names, read through their owners ----

/** The guaranteed tokens, as their owners spell them: the keys of Animation's `defaults` and Theme's `shadowDefaults`. */
export const durationTokens: readonly DurationToken[] = Object.freeze(Object.keys(animationDefaults.durations) as DurationToken[]);
export const easeTokens: readonly EaseToken[] = Object.freeze(Object.keys(animationDefaults.eases) as EaseToken[]);
export const shadowSteps: readonly ShadowStep[] = Object.freeze(Object.keys(shadowDefaults) as ShadowStep[]);

function checkToken<T extends string>(fn: string, kind: string, given: unknown, known: readonly T[]): T {
  if (typeof given !== 'string' || !known.includes(given as T)) fail(fn, `${JSON.stringify(given)} is not a ${kind} token`, `the tokens are ${known.join(', ')}`);
  return given as T;
}

/** Animation's `var(--duration-fast, 150ms)`; only the four guaranteed tokens, since an undeclared token is a silent 0s. */
export function duration(token: DurationToken, fn = 'duration'): string {
  return animationDuration(checkToken(fn, 'duration', token, durationTokens));
}

/** Animation's `var(--ease-out, ease-out)`, as duration(). */
export function ease(token: EaseToken, fn = 'ease'): string {
  return animationEase(checkToken(fn, 'ease', token, easeTokens));
}

/** `var(--shadow-md, <Theme's shadowDefaults.md>)`. */
export function shadow(step: ShadowStep, fn = 'shadow'): string {
  const s = checkToken(fn, 'shadow', step, shadowSteps);
  return read(`--shadow-${s}`, shadowDefaults[s]);
}

/** `var(--color-accent, <Theme's default accent>)`. */
export const accent = (): string => read('--color-accent', themeDefaults['--color-accent']);

/** The reads any function here can emit: every guaranteed duration, ease and shadow, and the accent. */
export const foreignReads: readonly string[] = Object.freeze([
  ...durationTokens.map((t) => `--duration-${t}`),
  ...easeTokens.map((t) => `--ease-${t}`),
  ...shadowSteps.map((s) => `--shadow-${s}`),
  '--color-accent',
]);

// ---- Knobs ----

/** Nine knobs. Pace has one owner: no `--fx-duration`/`--fx-ease` — a region is retuned by re-declaring Animation's `--duration-*`/`--ease-*` on a scope, which inheritance already does. */
export const knobNames = ['speed', 'lift-rise', 'shadow', 'shadow-lifted', 'dim', 'blur', 'frost', 'flash-color', 'flash-duration'] as const;
export type FxKnob = (typeof knobNames)[number];

export const knobProperty = (knob: FxKnob): `--fx-${FxKnob}` => `--fx-${knob}`;

/** The fallback each read carries: a literal, or another engine's token with its own fallback. */
export const knobDefaults: Readonly<Record<FxKnob, string>> = Object.freeze({
  speed: '1',
  'lift-rise': '-2px',
  shadow: shadow('sm'),
  'shadow-lifted': shadow('md'),
  dim: '0.5',
  blur: '4px',
  frost: '12px',
  'flash-color': accent(),
  'flash-duration': duration('slow'),
});

/** `var(--fx-<knob>, <default>)`. */
export const knob = (name: FxKnob): string => read(knobProperty(name), knobDefaults[name]);

/** The knobs whose default is a literal, so `registrations()` can give them a typed syntax and that initial value. */
export const registered: Readonly<Record<'speed' | 'lift-rise' | 'dim' | 'blur' | 'frost', string>> = Object.freeze({
  speed: '<number>',
  'lift-rise': '<length>',
  dim: '<number>',
  blur: '<length>',
  frost: '<length>',
});

// ---- Keyframes referenced, and steps ----

/** The keyframes this engine references, by Animation's name; their pace comes off its `vocabulary`, their ident off `ident()`. */
export const paired = ['fade-in', 'fade-out', 'pulse', 'shake'] as const satisfies readonly KeyframeName[];
export type Paired = (typeof paired)[number];

/** What the word holds after the keyframe ends — this engine's choice, not the keyframe's: an entrance pins both ends, an exit its end, a loop and the shake nothing. */
export const fills: Readonly<Record<Paired, string | null>> = Object.freeze({ 'fade-in': 'both', 'fade-out': 'forwards', pulse: null, shake: null });

export interface Pairing {
  readonly ident: string;
  readonly duration: DurationToken;
  readonly ease: EaseToken;
  readonly iterations: number | 'infinite';
  readonly fill: string | null;
}

/** One keyframe row's fields: Animation's ident and pace, this engine's fill. */
export function pairing(name: Paired, again = false): Pairing {
  const entry = vocabulary[name];
  return { ident: ident(name, again), duration: entry.duration, ease: entry.ease, iterations: entry.iterations, fill: fills[name] };
}

/** Every `anim-*` ident the sheet can emit, each one of Animation's `keyframes`. */
export const referenced: readonly string[] = Object.freeze([...paired.map((name) => ident(name)), ...restartable.map((name) => ident(name, true))].filter((id) => keyframes.includes(id)));

/** Elevation level → Theme's shadow step; a lift rises to the next, capped at the top. */
export const elevationSteps: readonly ShadowStep[] = Object.freeze(['none', 'sm', 'md', 'lg']);
export type Elevation = 0 | 1 | 2 | 3;

export function checkElevation(fn: string, given: unknown): Elevation {
  if (given !== 0 && given !== 1 && given !== 2 && given !== 3) fail(fn, `${JSON.stringify(given)} is not an elevation`, 'the levels are 0, 1, 2, 3');
  return given;
}
