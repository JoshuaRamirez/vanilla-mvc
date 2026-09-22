import { show } from './steps.ts';

export type LengthUnit = 'rem' | 'em' | 'px' | 'ch' | 'ex' | '%' | 'vw' | 'vh' | 'svw' | 'svh' | 'dvw' | 'dvh' | 'lvw' | 'lvh' | 'cqi' | 'cqw' | 'cqb' | 'cqh';
export type LengthFunction = 'var' | 'min' | 'max' | 'clamp' | 'calc';
/**
 * A length the author owns: 0, a number with a unit, or a CSS function. Never a bare number,
 * never a keyword — tsc refuses '20' and 'auto' before any build; assertLength refuses them for JS.
 */
export type Length = '0' | `${number}${LengthUnit}` | `${LengthFunction}(${string})`;

const LENGTH =
  /^(?:0|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:rem|em|px|ch|ex|%|vw|vh|svw|svh|dvw|dvh|lvw|lvh|cqi|cqw|cqb|cqh)|(?:var|min|max|clamp|calc)\(.+\))$/;

/**
 * Throws unless value is a Length free of `;`, `{` and `}` (a value must not close its declaration or block).
 * `fn` is the function called, `option` the option set: `layout: sidebar: width is "wide", not a CSS length; …`.
 */
export function assertLength(fn: string, option: string, value: unknown): asserts value is Length {
  if (typeof value !== 'string' || !LENGTH.test(value) || /[;{}]/.test(value)) {
    throw new RangeError(`layout: ${fn}: ${option} is ${show(value)}, not a CSS length; use one like '20rem', '50%' or 'clamp(…)'`);
  }
}

/**
 * A checked Length as CSS text. The one normalisation: bare `'0'` is emitted `0px`, because inside a
 * math function — grid's `min(<min>, 100%)` — an unitless zero is a <number>, not a <length>, and the
 * whole declaration is dropped. `0` and `0px` are the same length everywhere else, so one rule covers
 * every emission site and no caller has to know which of them composes into a calc.
 */
export function lengthText(value: Length): string {
  return value === '0' ? '0px' : value;
}

/** Throws unless value is one of the allowed keywords. tsc already refuses; this is for JS callers. */
export function assertKeyword<T extends string>(fn: string, option: string, value: unknown, allowed: readonly T[]): asserts value is T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new RangeError(`layout: ${fn}: ${option} is ${show(value)}; use one of ${allowed.map((k) => `'${k}'`).join(', ')}`);
  }
}

/** Throws on an option key the function does not have: a typo is never silently ignored. `path` prefixes a nested key: 'stack.'. */
export function known(fn: string, options: object, keys: readonly string[], path = ''): void {
  for (const key of Object.keys(options)) {
    if (!keys.includes(key)) throw new RangeError(`layout: ${fn}: no option ${show(path + key)}; the options are ${keys.join(', ')}`);
  }
}

/** A guard: throws unless value is a T, naming the function and the option. */
export type Check<T> = (fn: string, option: string, value: unknown) => asserts value is T;

/** The value when given (checked), else the fallback. */
export function given<T extends string>(fn: string, option: string, value: unknown, check: Check<T>, fallback: T): T {
  if (value === undefined) return fallback;
  check(fn, option, value);
  return value;
}

/** `prop: value; prop: value;` — undefined values are dropped, never printed. */
export function declarations(record: Readonly<Record<string, string | undefined>>): string {
  return Object.entries(record)
    .filter((entry) => entry[1] !== undefined)
    .map(([property, value]) => `${property}: ${value};`)
    .join(' ');
}
