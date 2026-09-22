import { type Align, aligns, assertRepeat, attributes, type Justify, justifies, type Repeat } from './knobs.ts';
import { assertStep, show, space, type Step } from './steps.ts';
import { assertKeyword, assertLength, declarations, given, known, type Length, lengthText } from './values.ts';

export type Primitive = 'stack' | 'cluster' | 'grid' | 'pair' | 'sidebar' | 'cover';
export const primitives: readonly Primitive[] = ['stack', 'cluster', 'grid', 'pair', 'sidebar', 'cover'];
export type Side = 'start' | 'end';
export const sides: readonly Side[] = ['start', 'end'];

export interface StackOptions {
  gap?: Step;
  align?: Align;
  list?: boolean;
}
export interface ClusterOptions {
  gap?: Step;
  align?: Align;
  justify?: Justify;
  list?: boolean;
}
export interface GridOptions {
  gap?: Step;
  min?: Length;
  repeat?: Repeat;
  dense?: boolean;
  list?: boolean;
}
/** A label beside its value: one column as wide as the widest label, one taking the rest. */
export interface PairOptions {
  gap?: Step;
  columnGap?: Step;
  list?: boolean;
}
export interface SidebarOptions {
  gap?: Step;
  width?: Length;
  min?: Length;
  side?: Side;
  align?: Align;
}
export interface CoverOptions {
  gap?: Step;
  min?: Length;
}
export type LayoutOptions = StackOptions | ClusterOptions | GridOptions | PairOptions | SidebarOptions | CoverOptions;

/** A child rule of a primitive: `where` follows the root selector (' > :first-child'); a list is one :where() group. */
export interface ChildRule {
  readonly where: readonly string[];
  readonly declarations: string;
}
/** A primitive's rules relative to its root: the root's declarations and its child rules. */
export interface Body {
  readonly root: string;
  readonly children: readonly ChildRule[];
}

/** Each primitive's option keys: an unknown key is refused by name, so a typo is never silently ignored. */
export const options = {
  stack: ['gap', 'align', 'list'],
  cluster: ['gap', 'align', 'justify', 'list'],
  grid: ['gap', 'min', 'repeat', 'dense', 'list'],
  pair: ['gap', 'columnGap', 'list'],
  sidebar: ['gap', 'width', 'min', 'side', 'align'],
  cover: ['gap', 'min'],
} as const;

/** The engine's own defaults: what a rule reads when neither an option nor a knob says otherwise. */
export const DEFAULTS = {
  stack: { gap: '4', align: 'stretch' },
  cluster: { gap: '2', align: 'center', justify: 'start' },
  grid: { gap: '4', min: '16rem', repeat: 'auto-fit' },
  pair: { gap: '1', columnGap: '3' },
  sidebar: { gap: '4', width: '16rem', min: '50%', align: 'stretch' },
  cover: { gap: '4', min: '100dvh' },
} as const;

/** grid-auto-flow: dense — the grid's one baked modifier, `data-layout-dense` in the sheet. */
export const DENSE = 'grid-auto-flow: dense;';

/**
 * A primitive on a <ul>, <ol> or <dl>: the marker box and the UA indent go, and the element's own
 * block margin with them, because the gap is the rhythm. `data-layout-list` in the sheet. The four
 * primitives that take it are the ones a list is ever laid out with; a sidebar or a cover refuses it
 * by name. Longhands only, so an author's `padding-inline-end` on the same element survives.
 */
export const LIST = 'list-style: none; padding-inline-start: 0; margin-block: 0;';

/** The four primitives `list` is an option on; ordered as `primitives` is. */
export const LISTABLE: readonly Primitive[] = ['stack', 'cluster', 'grid', 'pair'];

/** Throws unless the value is a boolean: `dense` and `list` are marks, never a length or a step. */
function markOf({ fn, path }: Caller, option: string, value: unknown): boolean {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new RangeError(`layout: ${fn}: ${path}${option} is ${show(value)}; use true or false`);
  }
  return value === true;
}

/**
 * Who is asking, for the messages: the function the author called and the path to these options inside
 * it. A block is its own caller, ('grid', ''); layout(defaults) calls the bodies as ('layout', 'grid.').
 */
export interface Caller {
  readonly fn: string;
  readonly path: string;
}
const own = (fn: string): Caller => ({ fn, path: '' });

const gapOf = ({ fn, path }: Caller, gap: unknown, fallback: Step): string => `var(--layout-gap, ${space(given(fn, `${path}gap`, gap, assertStep, fallback))})`;
const keywordOf = <T extends string>({ fn, path }: Caller, option: string, value: unknown, allowed: readonly T[], fallback: T): T =>
  given<T>(fn, path + option, value, (f, o, v) => assertKeyword(f, o, v, allowed), fallback);
const lengthOf = ({ fn, path }: Caller, option: string, value: unknown, fallback: Length): string => lengthText(given<Length>(fn, path + option, value, assertLength, fallback));
/** Repeat is the one option that is not a string, so it does not go through given(). */
const repeatOf = ({ fn, path }: Caller, value: unknown, fallback: Repeat): Repeat => {
  if (value === undefined) return fallback;
  assertRepeat(fn, `${path}repeat`, value);
  return value;
};
/** The list reset, when asked for: appended to a root's declarations, so it is that primitive's text. */
const listOf = (c: Caller, value: unknown): string => (markOf(c, 'list', value) ? ` ${LIST}` : '');

export function stackBody(o: StackOptions = {}, c: Caller = own('stack')): Body {
  known(c.fn, o, options.stack, c.path);
  return {
    root: declarations({
      display: 'flex',
      'flex-direction': 'column',
      gap: gapOf(c, o.gap, DEFAULTS.stack.gap),
      'align-items': `var(--layout-align, ${keywordOf(c, 'align', o.align, aligns, DEFAULTS.stack.align)})`,
    }) + listOf(c, o.list),
    children: [
      { where: [' > *'], declarations: 'margin-block: 0;' }, // the gap is the rhythm; UA margins would double it
      { where: [` > [${attributes.principal}]`], declarations: 'flex-grow: 1;' }, // a card's footer sits at the bottom
    ],
  };
}

export function clusterBody(o: ClusterOptions = {}, c: Caller = own('cluster')): Body {
  known(c.fn, o, options.cluster, c.path);
  return {
    root: declarations({
      display: 'flex',
      'flex-wrap': 'wrap',
      gap: gapOf(c, o.gap, DEFAULTS.cluster.gap),
      'align-items': `var(--layout-align, ${keywordOf(c, 'align', o.align, aligns, DEFAULTS.cluster.align)})`,
      'justify-content': `var(--layout-justify, ${keywordOf(c, 'justify', o.justify, justifies, DEFAULTS.cluster.justify)})`,
    }) + listOf(c, o.list),
    children: [],
  };
}

export function gridBody(o: GridOptions = {}, c: Caller = own('grid')): Body {
  known(c.fn, o, options.grid, c.path);
  const dense = markOf(c, 'dense', o.dense);
  const repeat = repeatOf(c, o.repeat, DEFAULTS.grid.repeat);
  const min = lengthOf(c, 'min', o.min, DEFAULTS.grid.min);
  return {
    root:
      declarations({
        display: 'grid',
        gap: gapOf(c, o.gap, DEFAULTS.grid.gap),
        // min(…, 100%): a container narrower than the minimum never overflows; auto-fit: a lone item fills the row.
        // A whole-number repeat is a fixed count: pair it with min: '0' for tracks that share and never overflow.
        'grid-template-columns': `repeat(var(--layout-grid-repeat, ${repeat}), minmax(min(var(--layout-grid-min, ${min}), 100%), 1fr))`,
        'grid-auto-flow': dense ? 'dense' : undefined,
      }) + listOf(c, o.list),
    children: [],
  };
}

/**
 * Two tracks: the first as wide as its widest item, the second taking the rest — a label beside its
 * value, the shape a <dl> of facts wants. The row gap is the shared --layout-gap, so data-layout-gap
 * moves it; the column gap is its own knob, because a fact list reads best with tighter rows than
 * columns. The child rule clears the UA margin a <dd> is indented by.
 */
export function pairBody(o: PairOptions = {}, c: Caller = own('pair')): Body {
  known(c.fn, o, options.pair, c.path);
  return {
    root:
      declarations({
        display: 'grid',
        'grid-template-columns': 'max-content 1fr',
        'row-gap': gapOf(c, o.gap, DEFAULTS.pair.gap),
        'column-gap': `var(--layout-pair-column-gap, ${space(given(c.fn, `${c.path}columnGap`, o.columnGap, assertStep, DEFAULTS.pair.columnGap))})`,
      }) + listOf(c, o.list),
    children: [{ where: [' > *'], declarations: 'margin: 0;' }],
  };
}

/** The side child: a fixed basis that grows a little. The main: fluid, and it wraps under the side when it cannot keep its minimum. */
const SIDE = 'flex-grow: 1; flex-basis: var(--layout-sidebar-basis);';
const MAIN = 'flex-grow: 999; flex-basis: 0; min-inline-size: var(--layout-sidebar-main-min);';

/** The two child rules for a side: first-child is the side unless side is 'end'. */
export function sidebarChildren(side: Side): readonly ChildRule[] {
  return side === 'end'
    ? [{ where: [' > :first-child'], declarations: MAIN }, { where: [' > :last-child'], declarations: SIDE }]
    : [{ where: [' > :first-child'], declarations: SIDE }, { where: [' > :last-child'], declarations: MAIN }];
}

/**
 * Exactly two children; flex, not grid, because grid cannot wrap asymmetric columns. The main wraps
 * under the side when it cannot keep --layout-sidebar-min: threshold ≈ container < (width + gap) / (1 − min).
 * The carriers copy each knob for the children, and a nested sidebar rewrites them at its own boundary.
 * Known edge: a sidebar that is itself the direct child of a sidebar declares its own carriers, so its
 * basis in the outer one comes from its own --layout-sidebar-width; wrap it when the two widths differ.
 */
export function sidebarBody(o: SidebarOptions = {}, c: Caller = own('sidebar')): Body {
  known(c.fn, o, options.sidebar, c.path);
  return {
    root: declarations({
      '--layout-sidebar-basis': `var(--layout-sidebar-width, ${lengthOf(c, 'width', o.width, DEFAULTS.sidebar.width)})`,
      '--layout-sidebar-main-min': `var(--layout-sidebar-min, ${lengthOf(c, 'min', o.min, DEFAULTS.sidebar.min)})`,
      display: 'flex',
      'flex-wrap': 'wrap',
      gap: gapOf(c, o.gap, DEFAULTS.sidebar.gap),
      'align-items': `var(--layout-align, ${keywordOf(c, 'align', o.align, aligns, DEFAULTS.sidebar.align)})`,
    }),
    children: sidebarChildren(keywordOf(c, 'side', o.side, sides, 'start')),
  };
}

/** A column at least the frame's height; auto margins centre the principal between whatever sits above and below. */
export function coverBody(o: CoverOptions = {}, c: Caller = own('cover')): Body {
  known(c.fn, o, options.cover, c.path);
  return {
    root: declarations({
      display: 'flex',
      'flex-direction': 'column',
      gap: gapOf(c, o.gap, DEFAULTS.cover.gap),
      'min-block-size': `var(--layout-cover-min, ${lengthOf(c, 'min', o.min, DEFAULTS.cover.min)})`,
    }),
    children: [
      { where: [' > *'], declarations: 'margin-block: 0;' },
      { where: [` > [${attributes.principal}]`, ' > :only-child'], declarations: 'margin-block: auto;' },
    ],
  };
}

export const bodies: Readonly<Record<Primitive, (o?: LayoutOptions, c?: Caller) => Body>> = {
  stack: stackBody,
  cluster: clusterBody,
  grid: gridBody,
  pair: pairBody,
  sidebar: sidebarBody,
  cover: coverBody,
};

/** A body as text inside the author's own block: declarations, then nested child rules at (0,0,0). */
export function nested({ root, children }: Body): string {
  return [root, ...children.map((c) => `:where(${c.where.map((w) => `&${w}`).join(', ')}) { ${c.declarations} }`)].join('\n');
}

/** A body as flat rules under a selector: the root at the selector's own specificity, the children at (0,0,0). */
export function flat(selector: string, { root, children }: Body): string {
  return [`${selector} { ${root} }`, ...flatChildren(selector, children)].join('\n');
}

export function flatChildren(selector: string, children: readonly ChildRule[]): string[] {
  return children.map((c) => `:where(${c.where.map((w) => `${selector}${w}`).join(', ')}) { ${c.declarations} }`);
}

// Per-selector blocks (channel C): rules that own a selector, placed inside it by the author.
// `.list { ${grid({ min: '12rem' })} }` — never for a value that changes per render.
export const stack = (o?: StackOptions): string => nested(stackBody(o));
export const cluster = (o?: ClusterOptions): string => nested(clusterBody(o));
export const grid = (o?: GridOptions): string => nested(gridBody(o));
export const pair = (o?: PairOptions): string => nested(pairBody(o));
export const sidebar = (o?: SidebarOptions): string => nested(sidebarBody(o));
export const cover = (o?: CoverOptions): string => nested(coverBody(o));
