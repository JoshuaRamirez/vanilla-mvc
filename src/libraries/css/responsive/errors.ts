/**
 * Every throw in the engine, in one place so the wording is reviewed in one place.
 * The shape is always one sentence — `responsive: <function>: <bad value>; <fix>` —
 * thrown as a RangeError. Types stop most of these at compile time; the runtime
 * sentence is for JavaScript callers and for values built at runtime.
 */

function fail(fn: string, bad: string, fix: string): never {
  throw new RangeError(`responsive: ${fn}: ${bad}; ${fix}`);
}

function show(value: unknown): string {
  return Array.isArray(value) ? `[${value.map(show).join(', ')}]` : typeof value === 'string' ? `'${value}'` : String(value);
}

/** rems('media.atLeast', 'medium') */
export function noBreakpoint(fn: string, value: unknown, names: readonly string[]): never {
  return fail(fn, `no breakpoint ${show(value)}`, `the names are ${names.join(', ')}, or a width like '30rem'`);
}

/** between('lg', 'md'): the lower bound is not below the upper one. */
export function notBelow(fn: string, lower: string, low: number, upper: string, high: number, fix: string): never {
  return fail(fn, `${lower} (${low}rem) is not below ${upper} (${high}rem)`, fix);
}

/** inContainer.query(…, 'my sidebar') */
export function notIdentifier(fn: string, name: string): never {
  return fail(fn, `'${name}' is not one CSS identifier`, `it must equal Layout's container-name`);
}

/** inContainer.query('30px'), inContainer.query('inline-size >= 30em') */
export function notCondition(fn: string, value: unknown, names: readonly string[]): never {
  return fail(
    fn,
    `${show(value)} is not a condition`,
    `write a breakpoint name (${names.join(', ')}), a rem width like '30rem', or a parenthesised condition like '(inline-size < 30rem)'`,
  );
}

/** clampBetween(NaN, …), fluid({ text: { sizes: { md: null } } }) */
export function notLength(fn: string, option: string, value: unknown): never {
  return fail(fn, `${option} ${String(value)} is not a length of 0rem or more`, `write a finite number of rem`);
}

/** clampBetween(2, 1, …) */
export function aboveMax(fn: string, min: number, max: number): never {
  return fail(fn, `min ${min}rem is above max ${max}rem`, `write ${fn}(${max}, ${min}, …)`);
}

/** fluid({ text: { base: [1.125, 1] } }) */
export function notPair(fn: string, option: string, value: unknown): never {
  return fail(fn, `${option} ${show(value)} is not a pair [min, max] of rem with 0 < min <= max`, `a scale grows from min at \`from\` to max at \`to\`, or stays put with min equal to max`);
}

/** fluid({ text: { ratio: 1 } }) */
export function notRatio(fn: string, value: unknown): never {
  return fail(fn, `text.ratio ${String(value)} is not a finite number above 1`, `write a ratio like 1.25, a major third`);
}

/** fluid({ space: { multipliers: [1, 2] } }) */
export function notMultipliers(fn: string, bad: string, fix: string): never {
  return fail(fn, `space.multipliers ${bad}`, fix);
}

/** fluid({ relativeTo: 'sideways' }) */
export function notOption(fn: string, option: string, value: unknown, choices: readonly string[]): never {
  return fail(fn, `${option} ${show(value)} is not one of ${choices.map((c) => `'${c}'`).join(', ')}`, `write one of them`);
}

/** fluid({ colour: 'red' }): an option key the function does not take. */
export function unknownKey(fn: string, option: string, key: string, accepted: readonly string[]): never {
  return fail(fn, `unknown option '${option}${key}'`, `the options are ${accepted.join(', ')}`);
}

/** fluid({ relativeTo: 'container' }) on the default selector. */
export function rootContainer(fn: string): never {
  return fail(
    fn,
    `relativeTo 'container' with selector ':root'`,
    `:root is above every container, so pass the selector of an element inside one — the component's root, e.g. selector: '.card'`,
  );
}
