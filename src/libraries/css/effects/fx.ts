/**
 * Channel A: the attribute value, typed. `fx(spec)` is the only runtime API a template
 * needs — `data-fx=${fx({ lift: 'hover', dim: m.saving && 'busy', shake: m.errorCount })}`.
 * Words come out in a fixed order whatever the object's key order, so equal specs are
 * byte-equal and the morph writes nothing; no word at all is `null`, so the attribute
 * is omitted. Every mistake throws one sentence naming the known set.
 */
import { animated, checkElevation, checkState, effectNames, type FxEffect, type FxState, restartable, stateful, stateNames } from './names.ts';
import { fail } from './text.ts';

/** How a stateful effect applies: always (`true`), in one state, or in several. */
export type On = boolean | FxState | readonly FxState[] | undefined | null;

export interface FxSpec {
  lift?: On;
  dim?: On;
  blur?: On;
  frost?: On;
  pulse?: On;
  /** No state suffix: the model says when the region is working. */
  waiting?: boolean | null;
  /** No state suffix: the word IS the hidden/open transition, or the cue. */
  fade?: boolean | null;
  'fade-in'?: boolean | null;
  'fade-out'?: boolean | null;
  /** A count from the model: 0/false → absent; odd → `shake`, even → `shake-again`, so every arrival replays. */
  shake?: number | boolean | null;
  /** A count, as shake; any count ≥ 1 is `flash`: a transition on an `::after` box the word creates, which replays when the word leaves for a render or under `data-key`. */
  flash?: number | boolean | null;
  elevation?: 0 | 1 | 2 | 3 | false | null;
}

/** What a spec may be keyed by: every effect word, with the four elevation words folded into one `elevation` level. */
export const specKeys: readonly string[] = Object.freeze([...effectNames.filter((effect) => !effect.startsWith('elevation-')), 'elevation']);

const isStateful = (effect: FxEffect): effect is (typeof stateful)[number] => (stateful as readonly string[]).includes(effect);
const isRestartable = (effect: FxEffect): boolean => (restartable as readonly string[]).includes(effect);

/**
 * `fx({ lift: 'hover', dim: 'busy', shake: 3, elevation: 2 })` → `'lift:hover dim:busy shake elevation-2'`;
 * `null` when nothing survives. Throws `effects: fx: <what>; <fix>` on an unknown key, an unknown state,
 * a state on an effect that takes none, a count that is not a whole number from 0, or two words that both
 * write `animation` (`shake` with `pulse`, `fade-in` with `fade-out`): the loser would vanish silently.
 */
export function fx(spec: FxSpec): string | null {
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) fail('fx', `the spec is ${spec === null ? 'null' : Array.isArray(spec) ? 'an array' : `a ${typeof spec}`}`, 'give an object keyed by effect');
  for (const key of Object.keys(spec)) if (!specKeys.includes(key)) fail('fx', `${JSON.stringify(key)} is not an effect`, `the keys are ${specKeys.join(', ')}`);
  const words: string[] = [];
  for (const effect of effectNames) {
    if (effect.startsWith('elevation-')) continue;
    const given = (spec as Record<string, unknown>)[effect];
    if (given === undefined || given === null || given === false || given === 0) continue;
    if (isStateful(effect)) words.push(...statefulWords(effect, given));
    else if (isRestartable(effect) || effect === 'flash') words.push(count(effect, given) % 2 === 0 && isRestartable(effect) ? `${effect}-again` : effect);
    else if (given === true) words.push(effect);
    else fail('fx', `${effect} is ${JSON.stringify(given)} and takes no state or count`, effect === 'waiting' ? 'write waiting: <boolean> from the model' : `write ${effect}: true; the element's own hidden, open or popover state drives it`);
  }
  if (spec.elevation !== undefined && spec.elevation !== null && spec.elevation !== false) words.push(`elevation-${checkElevation('fx', spec.elevation)}`);
  const playing = animated.filter((effect) => words.some((word) => word === effect || word.startsWith(`${effect}:`) || word === `${effect}-again`));
  if (playing.length > 1) fail('fx', `${playing[0]} and ${playing[1]} both set animation`, "keep one, or compose both with Animation's animation([...]) in a rule of your own");
  return words.length === 0 ? null : words.join(' ');
}

function statefulWords(effect: FxEffect, given: unknown): string[] {
  if (given === true) return [effect];
  const list = Array.isArray(given) ? given : [given];
  const chosen = new Set(list.map((state) => checkState('fx', state)));
  return stateNames.filter((state) => chosen.has(state)).map((state) => `${effect}:${state}`);
}

function count(effect: FxEffect, given: unknown): number {
  if (given === true) return 1;
  if (typeof given !== 'number' || !Number.isInteger(given) || given < 0) fail('fx', `${effect} restart ${JSON.stringify(given)} is not a count`, 'give the number of times the fact arrived, from 0');
  return given;
}
