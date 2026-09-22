import { assertStep, fallbacks, show, space, steps, type Step } from './steps.ts';
import { assertKeyword, assertLength, known, type Length, lengthText } from './values.ts';

// The values an author can set on the element that carries data-layout, and the names they travel under.

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
/** How many tracks a grid lays: a keyword that fits as many as it can, or a whole number of columns. */
export type Repeat = 'auto-fit' | 'auto-fill' | number;

export const aligns: readonly Align[] = ['start', 'center', 'end', 'stretch', 'baseline'];
export const justifies: readonly Justify[] = ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'];
/** The keyword half of Repeat; a whole number is the other half and is not listable. */
export const repeats: readonly ('auto-fit' | 'auto-fill')[] = ['auto-fit', 'auto-fill'];

/**
 * Throws unless value is a Repeat: one of the two keywords, or a whole number of columns 1 or more.
 * A fixed count usually wants `min: '0'` beside it — `repeat(2, minmax(0, 1fr))`, two tracks that
 * share the width and never overflow — where the keywords want a real minimum.
 */
export function assertRepeat(fn: string, option: string, value: unknown): asserts value is Repeat {
  const keyword = typeof value === 'string' && (repeats as readonly string[]).includes(value);
  const count = typeof value === 'number' && Number.isInteger(value) && value >= 1;
  if (!keyword && !count) {
    throw new RangeError(`layout: ${fn}: ${option} is ${show(value)}; use 'auto-fit', 'auto-fill' or a whole number of columns like 2`);
  }
}

/** The eight knobs, one record for all five primitives: the option is the property's tail, camel-cased. */
export interface Knobs {
  gap?: Step;
  align?: Align;
  justify?: Justify;
  gridMin?: Length;
  gridRepeat?: Repeat;
  pairColumnGap?: Step;
  sidebarWidth?: Length;
  sidebarMin?: Length;
  coverMin?: Length;
}

/** The attribute vocabulary, keyed by its word: attributes.side is `data-layout-side`. Every selector is built from it. */
export const attributes = {
  layout: 'data-layout',
  gap: 'data-layout-gap',
  side: 'data-layout-side',
  dense: 'data-layout-dense',
  list: 'data-layout-list',
  principal: 'data-layout-principal',
} as const;

export type KnobKind = 'step' | 'align' | 'justify' | 'repeat' | 'length';

/** One knob: the option word, the property it becomes, and how a value is checked. */
export interface Knob {
  readonly key: keyof Knobs;
  readonly name: `--layout-${string}`;
  readonly kind: KnobKind;
}

/** The knob table, in emission order. */
export const KNOBS: readonly Knob[] = [
  { key: 'gap', name: '--layout-gap', kind: 'step' },
  { key: 'align', name: '--layout-align', kind: 'align' },
  { key: 'justify', name: '--layout-justify', kind: 'justify' },
  { key: 'gridMin', name: '--layout-grid-min', kind: 'length' },
  { key: 'gridRepeat', name: '--layout-grid-repeat', kind: 'repeat' },
  { key: 'pairColumnGap', name: '--layout-pair-column-gap', kind: 'step' },
  { key: 'sidebarWidth', name: '--layout-sidebar-width', kind: 'length' },
  { key: 'sidebarMin', name: '--layout-sidebar-min', kind: 'length' },
  { key: 'coverMin', name: '--layout-cover-min', kind: 'length' },
];
const keys: readonly string[] = KNOBS.map(({ key }) => key);

/**
 * The sidebar's two carriers: set on the sidebar root from its knobs, read by its children. Unregistered,
 * so they inherit one level — that is their job — and a nested sidebar re-declares them at its own boundary.
 */
export const carriers = {
  basis: '--layout-sidebar-basis',
  mainMin: '--layout-sidebar-main-min',
} as const;

/** The engine's property surface: defines the eight knobs and two carriers, reads Theme's steps, overrides nothing. */
export const properties: { readonly defines: readonly string[]; readonly reads: readonly string[]; readonly overrides: readonly string[] } = Object.freeze({
  defines: Object.freeze([...KNOBS.map(({ name }) => name), ...Object.values(carriers)]),
  reads: Object.freeze(steps.map((step) => `--space-${step}`)),
  overrides: Object.freeze([]),
});

/**
 * One @property per knob, `syntax: '*'` and `inherits: false`, no initial value: a knob set on an element
 * reaches that element's rule and no descendant's, so nesting never leaks and every var() below takes its
 * fallback. The carriers are not here: they must inherit to the children.
 */
export function registrations(): string {
  return KNOBS.map(({ name }) => `@property ${name} { syntax: '*'; inherits: false; }`).join('\n');
}

/** The nine `[data-layout-gap="N"]` rules: the one knob a model sets, as an attribute, with no stylesheet work. */
export function stepRules(): string {
  return steps.map((step) => `[${attributes.gap}="${step}"] { --layout-gap: ${space(step)}; }`).join('\n');
}

/** The CSS text for a knob's value, checked for its kind: a step becomes var(--space-<step>, <fallback>). */
function valueOf(fn: string, { key, kind }: Knob, value: unknown): string {
  switch (kind) {
    case 'step':
      assertStep(fn, key, value);
      return `var(--space-${value}, ${fallbacks[value]})`;
    case 'align':
      assertKeyword(fn, key, value, aligns);
      return value;
    case 'justify':
      assertKeyword(fn, key, value, justifies);
      return value;
    case 'repeat':
      assertRepeat(fn, key, value);
      return String(value);
    case 'length':
      assertLength(fn, key, value);
      return lengthText(value);
  }
}

/**
 * `--layout-gap: var(--space-2, 0.5rem); --layout-grid-min: 12rem;` — declarations for a style attribute
 * or a rule body, in one fixed order whatever the object's key order, so equal values give equal text.
 * `knobs({})` is ''. Unknown keys and bad values are refused by name.
 */
export function knobs(options: Knobs): string {
  known('knobs', options, keys);
  const out: string[] = [];
  for (const knob of KNOBS) {
    const value = options[knob.key];
    if (value !== undefined) out.push(`${knob.name}: ${valueOf('knobs', knob, value)};`);
  }
  return out.join(' ');
}
