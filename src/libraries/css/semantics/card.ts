import { elevation, rules as effect } from '../effects/index.ts';
import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, radius, shadow, space, text, weight } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

/** The roles on which aria-selected is valid. Any other role, or none, selects with aria-current. */
export type CardRole = 'option' | 'tab' | 'treeitem' | 'row' | 'gridcell';
export const cardRoles: readonly CardRole[] = Object.freeze(['option', 'tab', 'treeitem', 'row', 'gridcell']);

export interface CardInputs {
  /** Tighter padding and gap: data-card-dense. */
  dense?: boolean;
  /** 0 flat with a border; 1 (the default) sm, 2 md, 3 lg shadow. */
  elevation?: 0 | 1 | 2 | 3;
  /** This card is the current one among its siblings: aria-current="true", or aria-selected on a role that admits it. */
  selected?: boolean;
  /** An ARIA role for the card. On option, tab, treeitem, row or gridcell selection is aria-selected="true"|"false"; null (the default) keeps <article>'s implicit role and selects with aria-current. */
  role?: CardRole | null;
}

export interface CardAttributes {
  /** Written bare: `<article data-card>`. */
  readonly 'data-card': true;
  /** `role=`; null leaves the element's own role. */
  readonly role: CardRole | null;
  /** `?data-card-dense=` */
  readonly 'data-card-dense': boolean;
  /** `data-card-elevation=`; the default, 1, is the base rule, so null. */
  readonly 'data-card-elevation': '0' | '2' | '3' | null;
  /** `aria-selected=`; "false" on an unselected option, tab, treeitem, row or gridcell; null on any other role. */
  readonly 'aria-selected': 'true' | 'false' | null;
  /** `aria-current=`; "true" when selected with no aria-selected role; never "false". */
  readonly 'aria-current': 'true' | null;
}

const cardOptions: readonly (keyof CardInputs)[] = Object.freeze(['dense', 'elevation', 'selected', 'role']);

/** Pure, deterministic; the record is frozen. Refuses a non-object and an unknown key by name (TypeError). */
export function cardAttributes(inputs: CardInputs = {}): CardAttributes {
  options('cardAttributes', inputs, cardOptions);
  const role = inputs.role ?? null;
  const selectable = role !== null && cardRoles.includes(role);
  const selected = inputs.selected === true;
  const elevation = inputs.elevation;
  return Object.freeze({
    'data-card': true as const,
    role,
    'data-card-dense': inputs.dense === true,
    'data-card-elevation': elevation === 0 || elevation === 2 || elevation === 3 ? (String(elevation) as '0' | '2' | '3') : null,
    'aria-selected': selectable ? (selected ? 'true' : 'false') : null,
    'aria-current': !selectable && selected ? 'true' : null,
  });
}

/**
 * The card's own text: Theme's readers interpolated as plain var() text, so every read resolves on
 * the card and a scoped [data-theme] reaches it. Every knob is declared on the card itself and read
 * without a fallback; modifiers reassign it. Elevation is Effects': elevation(n) declares
 * --fx-shadow and --fx-shadow-lifted one step up, --card-shadow reads --fx-shadow, and each
 * elevation rule restates `box-shadow: var(--card-shadow)` after Effects' own box-shadow line, so a
 * --card-shadow an author sets on [data-card] still wins the resting shadow. Regions are HTML:
 * `> header`, `> footer`; the card is a grid, so no body element.
 */
/** Effects' elevation(n), indented as a declaration of the rule it sits in. */
const shadows = (level: 0 | 1 | 2 | 3): string => elevation(level).replace(/^/gm, '  ');

const own = `/* semantics: card */
[data-card] {
  --card-padding: ${space('4')};
  --card-gap: ${space('3')};
  --card-shadow: var(--fx-shadow, ${shadow('sm')});
${shadows(1)}
  display: grid;
  gap: var(--card-gap);
  padding: var(--card-padding);
  min-inline-size: 0;
  border: 1px solid transparent;
  border-radius: ${radius('md')};
  background: ${color('surface-raised')};
  color: ${color('text')};
  box-shadow: var(--card-shadow);
}
[data-card][data-card-dense] {
  --card-padding: ${space('2')};
  --card-gap: ${space('1')};
}
[data-card][data-card-elevation="0"] {
${shadows(0)}
  box-shadow: var(--card-shadow);
  border-color: ${color('border')};
}
[data-card][data-card-elevation="2"] {
${shadows(2)}
  box-shadow: var(--card-shadow);
}
[data-card][data-card-elevation="3"] {
${shadows(3)}
  box-shadow: var(--card-shadow);
}
[data-card]:is([aria-current="true"], [aria-selected="true"]) { border-color: ${color('accent')}; }
[data-card]:focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
[data-card] > header { font-weight: ${weight('medium')}; }
[data-card] > footer { color: ${color('text-muted')}; font-size: ${text('sm')}; }
[data-card] > :is(header, footer) > * { margin-block: 0; }
`;

/** The hover lift is Effects' rule on the card's selector, composed last so it wins the elevation rows' box-shadow at equal specificity. */
const lift = effect('lift', { selector: '[data-card]', states: ['hover'] });

const sheet: StyleResult = css`${own}
${lift}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function cardRules(): StyleResult {
  return sheet;
}

export const cardProperties: Properties = Object.freeze({
  defines: Object.freeze(['--card-padding', '--card-gap', '--card-shadow']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
