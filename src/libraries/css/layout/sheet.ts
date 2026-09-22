import { css, type StyleResult } from '../templates/index.ts';
import { attributes, registrations, stepRules } from './knobs.ts';
import { bodies, type ClusterOptions, type CoverOptions, DENSE, flatChildren, flat, type GridOptions, type LayoutOptions, LIST, LISTABLE, options, type PairOptions, type Primitive, primitives, sidebarChildren, type SidebarOptions, type StackOptions } from './primitives.ts';
import { known } from './values.ts';

/** Per-primitive defaults for the document sheet: each moves the fallback its rule reads, and nothing else. */
export interface LayoutDefaults {
  stack?: Omit<StackOptions, 'list'>;
  cluster?: Omit<ClusterOptions, 'list'>;
  grid?: Omit<GridOptions, 'dense' | 'list'>;
  pair?: Omit<PairOptions, 'list'>;
  sidebar?: Omit<SidebarOptions, 'side'>;
  cover?: CoverOptions;
}

/** The option words that are attributes in the sheet, never defaults: the sheet has a rule for each value. */
const list = { key: 'list', attribute: attributes.list };
const ATTRIBUTE_OPTIONS: Readonly<Partial<Record<Primitive, readonly { key: string; attribute: string }[]>>> = {
  stack: [list],
  cluster: [list],
  grid: [{ key: 'dense', attribute: attributes.dense }, list],
  pair: [list],
  sidebar: [{ key: 'side', attribute: attributes.side }],
};

const at = (primitive: Primitive): string => `[${attributes.layout}="${primitive}"]`;
const memo = new Map<string, StyleResult>();

/**
 * The document sheet, once: registrations() (the @property rules) + the six primitives as flat rules under
 * their data-layout selector (root at (0,1,0), children :where()) + the word modifiers + stepRules() (the
 * nine [data-layout-gap] rules). Pure and memoized by its defaults; an unknown key is refused by name
 * before the memo, so a typo never returns a cached sheet.
 */
export function layout(defaults: LayoutDefaults = {}): StyleResult {
  known('layout', defaults, primitives);
  for (const primitive of primitives) {
    const given = defaults[primitive];
    if (given === undefined) continue;
    for (const { key, attribute } of ATTRIBUTE_OPTIONS[primitive] ?? []) {
      if (key in given) {
        throw new RangeError(`layout: layout: ${primitive}.${key} is an attribute, not a default; set ${attribute} on the element`);
      }
    }
    known('layout', given, options[primitive], `${primitive}.`);
  }
  const key = JSON.stringify(primitives.map((p) => [p, defaults[p] ?? null]));
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const sheet = [
    registrations(),
    ...primitives.map((p) => flat(at(p), bodies[p](defaults[p] as LayoutOptions | undefined, { fn: 'layout', path: `${p}.` }))),
    `${at('grid')}[${attributes.dense}] { ${DENSE} }`,
    `${LISTABLE.map((p) => `${at(p)}[${attributes.list}]`).join(', ')} { ${LIST} }`,
    ...flatChildren(`${at('sidebar')}[${attributes.side}="end"]`, sidebarChildren('end')),
    stepRules(),
  ].join('\n');
  // One css call; the text is raw CSS at statement start, composed verbatim. Document level only:
  // apply(layout(), document) adopts it unwrapped, so the @property rules stay at the top level.
  const result = css`${sheet}`;
  memo.set(key, result);
  return result;
}
