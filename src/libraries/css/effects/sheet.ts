/**
 * The static sheet and its parts: sheet() once at the document, rules() for one
 * effect on the attribute hook or the author's own selector, registrations() for
 * the typed knobs. Each returns a StyleResult from one css call on the templates
 * folder, the text composed at statement start, so a style writes `${rules(…)}` as
 * a statement. Selectors: a steady row is `[data-fx~="dim"][data-fx]` — the
 * attribute twice on purpose — and a state row `[data-fx~="dim:busy"][aria-busy="true"]`,
 * so every effect row is (0,2,0) and beats a one-class rest rule; setup is `:where`, zero.
 */
import { css, type StyleResult } from '../templates/index.ts';
import { checkEffect, checkState, checkStateful, describe, effectNames, type FxEffect, type FxState, knobDefaults, knobProperty, registered, stateful, stateNames, states } from './names.ts';
import { body, fadeRows, flashRows, frostBackdrop, type Rowed, setup } from './rows.ts';
import { block, comment, declaration, fail, known, text } from './text.ts';

export interface RulesOptions {
  /** The author's selector instead of the attribute hook; one selector, not a list. */
  selector?: string;
  /** The states to emit rows for. Hooked: default all for a stateful effect, `[]` for steady only. On a selector: given, state rows only; absent or `[]`, the steady row. */
  states?: readonly FxState[];
}

export interface SheetOptions {
  /** Trim the effect × state matrix; default all eleven. */
  states?: readonly FxState[];
}

const hook = (word: string): string => `[data-fx~="${word}"]`;
const rulesKeys = ['selector', 'states'] as const;
const sheetKeys = ['states'] as const;

/** A state list: an array of known states, refused by name otherwise. */
function stateList(fn: string, given: unknown): FxState[] {
  if (!Array.isArray(given)) fail(fn, 'states is not an array', `list states from ${stateNames.join(', ')}, or [] for none`);
  return given.map((state) => checkState(fn, state));
}
const isStateful = (effect: FxEffect): boolean => (stateful as readonly string[]).includes(effect);

/**
 * One effect's rule group, opened by `/* fx:<name> — <describe(name)> *\/`. Hooked (no selector): the steady
 * row(s) the bare word always resolves to, then a row per state. On a selector: the setup longhands lead, since
 * `:where([data-fx])` does not match there — in their own row before the state rows the author asked for, or
 * at the head of the steady row; flash needs none, its box carries its own transition.
 */
export function rules(effect: FxEffect, options: RulesOptions = {}): StyleResult {
  return css`${rulesText(effect, options)}`;
}

function rulesText(effect: FxEffect, options: RulesOptions): string {
  const name = checkEffect('rules', effect);
  known('rules', options, rulesKeys);
  const selector = options.selector === undefined ? null : text('rules', 'selector', options.selector);
  const chosen = options.states === undefined ? null : stateList('rules', options.states);
  if (chosen !== null && chosen.length > 0) checkStateful('rules', name);
  const ordered = (list: readonly FxState[]): FxState[] => stateNames.filter((state) => list.includes(state));
  let out = comment(`fx:${name} — ${describe(name)}`);
  if (selector === null) {
    out += group(name, hook(name), `${hook(name)}[data-fx]`, true);
    for (const state of ordered(chosen ?? (isStateful(name) ? stateNames : []))) out += block(`${hook(`${name}:${state}`)}${states[state]}`, body(name as Rowed));
  } else {
    if (chosen !== null && chosen.length > 0) {
      const word = checkStateful('rules', name);
      out += block(selector, setup());
      for (const state of ordered(chosen)) out += block(`${selector}${states[state]}`, body(word));
    } else out += group(name, selector, selector, false);
  }
  return out;
}

/** The steady form of one effect: one row, or the group for fade, flash, frost and the shake pair. Unhooked, the setup leads the row. */
function group(name: Rowed | 'fade' | 'flash', base: string, own: string, hooked: boolean): string {
  if (name === 'fade') return fadeRows(base, own, hooked);
  if (name === 'flash') return flashRows(base, own);
  const row = body(name);
  let out = block(own, hooked ? row : `${setup()}\n${row}`);
  if (name === 'frost') out += frostBackdrop(own);
  if (name === 'shake' && hooked) out += block(`${hook('shake-again')}[data-fx]`, body('shake', true));
  return out;
}

/** The whole sheet: setup at `:where`, then every effect's group in `effectNames` order. No `:root`; keyframes are referenced, never emitted. Document level. */
export function sheet(options: SheetOptions = {}): StyleResult {
  known('sheet', options, sheetKeys);
  const chosen = options.states === undefined ? undefined : stateList('sheet', options.states);
  const text = block(':where([data-fx])', setup()) + effectNames.map((effect) => rulesText(effect, isStateful(effect) && chosen !== undefined ? { states: chosen } : {})).join('');
  return css`${text}`;
}

/**
 * `@property` for the five literal-defaulted knobs, typed, inheriting, initial = the default, so a bad value in
 * DevTools falls to the default instead of invalidating the property that reads it. The only `@property` this
 * engine emits; document level — the shell applies it to `document` beside sheet().
 */
export function registrations(): StyleResult {
  const text = (Object.keys(registered) as (keyof typeof registered)[])
    .map((knob) => block(`@property ${knobProperty(knob)}`, [declaration('syntax', `'${registered[knob]}'`), declaration('inherits', 'true'), declaration('initial-value', knobDefaults[knob])].join('\n')))
    .join('');
  return css`${text}`;
}
