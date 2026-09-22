/**
 * effects: transitions, fades, attention-getters, elevation and blur as CSS, written on
 * animation's and theme's names.
 *
 * The sheet is static text, applied once to the document and never regenerated. Everything that
 * changes at runtime changes through one of three channels: a word in `data-fx`, a `--fx-*` knob,
 * or a parity flip in the word for a restartable one-shot. A state is named, never selected —
 * `lift:hover`, `dim:busy` — so no data twin is kept in step.
 *
 * ./README.md has the three channels, the state and specificity rules, what each word does, the
 * knobs and their fallbacks, and the browser floor.
 */
export { fx, type FxSpec, type On, specKeys } from './fx.ts';
export {
  attributes,
  describe,
  descriptions,
  type DurationToken,
  durationTokens,
  type EaseToken,
  easeTokens,
  effectNames,
  type Elevation,
  elevationSteps,
  type FxEffect,
  type FxKnob,
  type FxState,
  knobDefaults,
  knobNames,
  knobProperty,
  restartable,
  type ShadowStep,
  shadowSteps,
  stateful,
  stateNames,
  states,
  when,
} from './names.ts';
export { registrations, rules, type RulesOptions, sheet, type SheetOptions } from './sheet.ts';
export { discrete, elevation, transition, type TransitionOptions, type TransitionProperty, transitioned } from './transition.ts';

import { foreignReads, knobNames, knobProperty } from './names.ts';

/** Every custom property this engine defines (the nine `--fx-*` knobs), reads from another engine (13: the four durations, four eases, four shadows and the accent) and re-declares (none). */
export const properties: { readonly defines: readonly string[]; readonly reads: readonly string[]; readonly overrides: readonly string[] } = Object.freeze({
  defines: Object.freeze(knobNames.map(knobProperty)),
  reads: foreignReads,
  overrides: Object.freeze([]),
});
