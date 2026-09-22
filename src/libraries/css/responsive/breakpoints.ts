import { noBreakpoint, notBelow } from './errors.ts';

/**
 * The one source of truth for breakpoints, in rem, ascending:
 * sm 40 (640px) · md 48 (768px) · lg 64 (1024px) · xl 80 (1280px) at the 16px default.
 *
 * rem, not em, not px. px would ignore the reader's font-size preference. Under
 * @media, em and rem both resolve against the initial font-size, so they are equal
 * there; under @container, em resolves against the container's own font-size — a
 * hero with larger type would reach its breakpoint sooner — while rem still means
 * the root. rem is the one unit under which one constant means one width in both
 * query kinds. A font-relative threshold stays available where the author writes
 * the unit: inContainer.query('(inline-size >= 30em)').
 *
 * A TS constant, not a custom property: media queries cannot read properties.
 */
export const breakpoints = Object.freeze({ sm: 40, md: 48, lg: 64, xl: 80 } as const);

export type Breakpoint = keyof typeof breakpoints;

/** A one-off width in rem, '30rem'. The type refuses '30px' at compile time; the sentence refuses it in JavaScript. */
export type Rem = `${number}rem`;

/** A breakpoint name, or a one-off rem width. */
export type Width = Breakpoint | Rem;

/** The names, in ascending order; the tuple is what Above<B> is computed from. */
export const breakpointNames = Object.freeze(['sm', 'md', 'lg', 'xl'] as const) satisfies readonly Breakpoint[];

type Names = typeof breakpointNames;
type After<T extends readonly unknown[], B> = T extends readonly [infer Head, ...infer Rest] ? (Head extends B ? Rest[number] : After<Rest, B>) : never;
// Every breakpoint is in the tuple, so Above<B> never silently loses a name.
const complete: Exclude<Breakpoint, Names[number]> extends never ? true : never = true;
void complete;

/** The names above one: Above<'md'> is 'lg' | 'xl'; Above<'xl'> is never. */
export type Above<B extends Breakpoint> = After<Names, B>;

/**
 * What may close a band opened at A. For a name: a name above it (so between('lg', 'md')
 * is a compile error and completion offers only 'xl') or a rem width; for a rem width:
 * any width. Whatever the type lets through is still checked at runtime.
 */
export type Upper<A extends Width> = A extends Breakpoint ? Above<A> | Rem : Width;

const REM = /^(?:\d+\.?\d*|\.\d+)rem$/;

export function isBreakpoint(value: unknown): value is Breakpoint {
  return typeof value === 'string' && Object.hasOwn(breakpoints, value);
}

export function isRem(value: unknown): value is Rem {
  return typeof value === 'string' && REM.test(value);
}

/** A width as a number of rem. `fn` is the public function the sentence names. */
export function rems(fn: string, value: Width): number {
  if (isBreakpoint(value)) return breakpoints[value];
  if (isRem(value)) return parseFloat(value);
  return noBreakpoint(fn, value, breakpointNames);
}

/** A half-open band [from, to) as two numbers of rem; from must be below to. */
export function band(fn: string, from: Width, to: Width): readonly [number, number] {
  const low = rems(fn, from);
  const high = rems(fn, to);
  if (low < high) return [low, high];
  const verb = fn.slice(fn.lastIndexOf('.') + 1);
  const fix = low === high ? 'a band needs two different widths, the lower first' : `write ${verb}('${to}', '${from}')`;
  return notBelow(fn, `'${from}'`, low, `'${to}'`, high, fix);
}

/** width('md') → '48rem'; width('30rem') → '30rem'. The only place the unit is spelled; use it inside a hand-written condition. */
export function width(value: Width): Rem {
  return `${rems('width', value)}rem`;
}
