/**
 * layout: six structural primitives — stack, cluster, grid, pair, sidebar, cover — hooked by
 * `data-layout` on an element.
 *
 * The attribute is the primitive, and words are attributes too (`data-layout-gap`,
 * `data-layout-list`, `data-layout-principal`). Lengths and keywords are knobs: custom properties
 * set on the element that carries `data-layout`, never on an ancestor, since every knob is
 * registered `inherits: false`.
 *
 * ./README.md has the three rules, the three channels a value arrives by, the option-to-knob
 * mapping, and the browser floor.
 */
export { assertName, contain, container, containments, contentVisibility, type Containment } from './containment.ts';
export { diagnostics, faults } from './diagnostics.ts';
export {
  aligns,
  assertRepeat,
  attributes,
  carriers,
  justifies,
  KNOBS,
  knobs,
  properties,
  registrations,
  repeats,
  stepRules,
  type Align,
  type Justify,
  type Knobs,
  type Repeat,
} from './knobs.ts';
export {
  cluster,
  cover,
  DEFAULTS,
  grid,
  LIST,
  LISTABLE,
  options,
  pair,
  primitives,
  sidebar,
  sides,
  stack,
  type ClusterOptions,
  type CoverOptions,
  type GridOptions,
  type LayoutOptions,
  type PairOptions,
  type Primitive,
  type Side,
  type SidebarOptions,
  type StackOptions,
} from './primitives.ts';
export { layout, type LayoutDefaults } from './sheet.ts';
export { assertStep, fallbacks, space, steps, type Step } from './steps.ts';
export { assertKeyword, assertLength, type Length, type LengthFunction, type LengthUnit, lengthText } from './values.ts';
