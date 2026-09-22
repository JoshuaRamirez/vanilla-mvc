import { show } from './steps.ts';
import { assertKeyword, assertLength, type Length, lengthText } from './values.ts';

// Declarations for the author's own rule: css`:scope > .pane { ${container('pane')} }`. Static text.

/** The longhand values of `contain`; the shorthands `content` and `strict` stand alone. */
export type Containment = 'size' | 'inline-size' | 'layout' | 'style' | 'paint';
export const containments: readonly Containment[] = ['size', 'inline-size', 'layout', 'style', 'paint'];
type Shorthand = 'content' | 'strict';
const shorthands: readonly Shorthand[] = ['content', 'strict'];
const containValues: readonly (Shorthand | Containment)[] = [...shorthands, ...containments];

type ContainerType = 'inline-size' | 'size';
const containerTypes: readonly ContainerType[] = ['inline-size', 'size'];

const IDENT = /^-?[A-Za-z_][\w-]*$/;
const RESERVED = ['none', 'and', 'or', 'not', 'default', 'initial', 'inherit', 'unset', 'revert', 'revert-layer'];

/** Throws unless value is one CSS identifier that no container prelude reads as a keyword. */
export function assertName(fn: string, option: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !IDENT.test(value) || RESERVED.includes(value.toLowerCase())) {
    throw new RangeError(`layout: ${fn}: ${option} is ${show(value)}, not a container name; use one word like 'card'`);
  }
}

/**
 * `container-type: inline-size; container-name: <name>;` — the longhands, so an author's own `container-name`
 * on the same element composes. Responsive queries `@container <name> (…)`. inline-size is size containment on
 * the inline axis: put it on a block-level element whose width comes from its parent, never on a flex item or
 * an inline box (it collapses). The primitive that responds is the container's child, never the container.
 */
export function container(name: string, type: ContainerType = 'inline-size'): string {
  assertName('container', 'name', name);
  assertKeyword('container', 'type', type, containerTypes);
  return `container-type: ${type}; container-name: ${name};`;
}

/** `contain: content;` or `contain: strict;` — the shorthands stand alone. */
export function contain(kind: Shorthand): string;
/** `contain: layout paint;` — any of the longhands, in the order given; never both `size` and `inline-size`. */
export function contain(first: Containment, ...rest: readonly Containment[]): string;
export function contain(...values: readonly string[]): string {
  const list = (vs: readonly string[]): string => vs.map((v) => `'${v}'`).join(', ');
  if (values.length === 0) throw new RangeError(`layout: contain: no value; give at least one of ${list(containValues)}`);
  for (const value of values) assertKeyword('contain', 'value', value, containValues);
  const shorthand = values.find((v) => v === 'content' || v === 'strict');
  if (shorthand !== undefined && values.length > 1) {
    // CSS would drop the whole declaration silently.
    throw new RangeError(`layout: contain: '${shorthand}' stands alone, got ${list(values)}; pass it by itself`);
  }
  if (values.includes('size') && values.includes('inline-size')) {
    throw new RangeError(`layout: contain: 'size' and 'inline-size' together, got ${list(values)}; keep one`);
  }
  return `contain: ${values.join(' ')};`;
}

/**
 * `content-visibility: auto; contain-intrinsic-block-size: auto <size>;` — the runtime win for long lists:
 * offscreen items skip layout and paint. The size is the author's and required: `auto` alone lets
 * offscreen content collapse to zero and the scrollbar jump.
 */
export function contentVisibility(size: Length): string {
  assertLength('contentVisibility', 'size', size);
  return `content-visibility: auto; contain-intrinsic-block-size: auto ${lengthText(size)};`;
}
