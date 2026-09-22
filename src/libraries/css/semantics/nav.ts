import { transition } from '../effects/index.ts';
import { block, inContainer } from '../responsive/index.ts';
import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, space, weight } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

/** A navigation landmark has a name — a page may hold several. Either the text itself, or the id of the visible heading that names it; labelledBy wins when both are given. */
export type NavName = { label: string } | { labelledBy: string };

export type NavInputs = NavName & {
  /**
   * Pin the column axis whatever the container says. Absent (the default) means the container
   * decides: a row while it is narrow, a column from md. `aria-orientation` is not valid on the
   * navigation role — it belongs to toolbar, listbox, menu, tablist and the rest — so the nav's
   * axis is a modifier where the toolbar's is a state.
   */
  vertical?: boolean;
};

export interface NavAttributes {
  /** Written bare: `<nav data-nav>`. */
  readonly 'data-nav': true;
  /** `aria-label=`; null when labelledBy names it. */
  readonly 'aria-label': string | null;
  /** `aria-labelledby=` */
  readonly 'aria-labelledby': string | null;
  /** `?data-nav-vertical=` */
  readonly 'data-nav-vertical': boolean;
}

export interface NavLinkInputs {
  /** This link is the page you are on: aria-current="page". */
  current?: boolean;
}

export interface NavLinkAttributes {
  /** `aria-current=`; never "false" — an absent aria-current is the only way to say "not this one". */
  readonly 'aria-current': 'page' | null;
}

const navOptions: readonly string[] = Object.freeze(['label', 'labelledBy', 'vertical']);
const navLinkOptions: readonly (keyof NavLinkInputs)[] = Object.freeze(['current']);

/** Pure, deterministic; the record is frozen. An empty string is no name; labelledBy wins over label. Refuses a non-object and an unknown key by name (TypeError). */
export function navAttributes(inputs: NavInputs): NavAttributes {
  options('navAttributes', inputs, navOptions);
  const labelledBy = 'labelledBy' in inputs && inputs.labelledBy ? inputs.labelledBy : null;
  const label = labelledBy === null && 'label' in inputs && inputs.label ? inputs.label : null;
  return Object.freeze({
    'data-nav': true as const,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'data-nav-vertical': inputs.vertical === true,
  });
}

/** One link's state, bound per link: `aria-current=${link['aria-current']}`. Pure, frozen, refused by name like the rest. */
export function navLinkAttributes(inputs: NavLinkInputs = {}): NavLinkAttributes {
  options('navLinkAttributes', inputs, navLinkOptions);
  return Object.freeze({ 'aria-current': inputs.current === true ? ('page' as const) : null });
}

/**
 * THE AXIS IS THE CONTAINER'S. The base rule is a wrapping row; from md the nav is a column down
 * the side. The bands are container queries, not media queries, so the same nav in a dialog, a
 * sidebar or a page column draws to the space it has and re-evaluates when that space changes —
 * which a media query never notices. They are unnamed, so they resolve against the nearest ancestor
 * container: a named one could only be declared on `[data-nav]` itself, and a container never
 * measures itself, so the nav's own axis could never follow it. **The author declares the container**
 * (Layout's container(), on the frame around the nav); with none declared neither band matches and
 * the wrapping row is what draws, which is the safe fall-back.
 *
 * Regions: `[data-nav-brand]` is the product-level item that opens the bar, `[data-nav-title]` a
 * prominent label naming the links after it, with a rule drawn before it — across the inline axis
 * in a row, across the block axis in a column. HTML has an element for neither. The current page is
 * `aria-current="page"` from navLinkAttributes; a class named "active" is the hand-written twin of
 * a state ARIA already has (WRONG FORM, index.ts).
 */
const column = (on: string): string => `${on} {
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  min-block-size: 100%;
  border-block-end: 0;
  border-inline-end: 1px solid ${color('border')};
}
${on} [data-nav-brand] { margin-inline-end: 0; margin-block-end: ${space('3')}; }
${on} [data-nav-title] { padding-inline-start: 0; border-inline-start: 0; padding-block-start: ${space('3')}; border-block-start: 1px solid ${color('border')}; }
`;

/** Effects' transition on the link colour, indented as a declaration of the rule it sits in. */
const linkTransition = transition(['color']).replace(/^/gm, '  ');

const own = `/* semantics: nav */
[data-nav] {
  --nav-gap: ${space('3')};
  --nav-padding: ${space('3')} ${space('5')};
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--nav-gap);
  padding: var(--nav-padding);
  min-inline-size: 0;
  background: ${color('surface-raised')};
  border-block-end: 1px solid ${color('border')};
}
[data-nav] a {
  color: ${color('text-muted')};
  text-decoration: none;
${linkTransition}
}
[data-nav] a:hover { color: ${color('accent')}; }
[data-nav] a[aria-current="page"] { color: ${color('accent')}; font-weight: ${weight('medium')}; }
[data-nav] [data-nav-brand] { color: ${color('text')}; font-weight: ${weight('bold')}; margin-inline-end: ${space('4')}; }
[data-nav] [data-nav-title] { color: ${color('text')}; font-weight: ${weight('medium')}; padding-inline-start: ${space('4')}; border-inline-start: 1px solid ${color('border')}; }
[data-nav] :focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
${column('[data-nav][data-nav-vertical]')}`;

/** Narrow: one row that scrolls rather than growing to three lines. A pinned column never takes it. */
const narrow = block(inContainer.below.md, `[data-nav]:not([data-nav-vertical]) { flex-wrap: nowrap; overflow: auto; }`);
/** From md: the column, on the nav the author has not pinned — so an explicit vertical needs no override and a band never fights the record. */
const wide = block(inContainer.atLeast.md, column('[data-nav]:not([data-nav-vertical])').trimEnd());

const sheet: StyleResult = css`${own}
${narrow}${wide}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function navRules(): StyleResult {
  return sheet;
}

export const navProperties: Properties = Object.freeze({
  defines: Object.freeze(['--nav-gap', '--nav-padding']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
