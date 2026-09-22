/**
 * The one place CSS text is formatted. Every emitted line is a declaration() or a block(),
 * and every value passes text(), so a bad option fails here at definition, not in DevTools:
 * undefined, null, NaN, a non-finite number, an object, an empty string, or text holding
 * `;`, `{` or `}`. Every throw in the engine is one sentence, thrown by fail():
 * `animation: <function>: <what>; <fix>`.
 */

/** Throw the engine's one sentence. */
export function fail(where: string, what: string, fix: string): never {
  throw new Error(`animation: ${where}: ${what}; ${fix}`);
}

/** A value fit for text: a finite number, or a non-empty string with no `;`, `{` or `}`. */
export function text(where: string, what: string, given: unknown, fix = 'give a string or a finite number'): string {
  if (typeof given === 'number') {
    if (!Number.isFinite(given)) fail(where, `${what} is ${given}`, 'give a finite number');
    return String(given);
  }
  if (typeof given !== 'string') fail(where, `${what} is ${describe(given)}`, fix);
  if (given.trim() === '') fail(where, `${what} is empty`, fix);
  if (/[;{}]/.test(given)) fail(where, `${what} ${JSON.stringify(given)} holds ";", "{" or "}"`, 'a value is one CSS value; the rule goes around it');
  return given;
}

/** One line: `name: value;`. */
export function declaration(name: string, value: unknown): string {
  return `${text('declaration', 'the property name', name)}: ${text('declaration', name, value)};`;
}

/** One rule: the prelude, the body indented two spaces, the closing brace and a newline, so blocks concatenate. */
export function block(prelude: string, body: string): string {
  if (typeof body !== 'string' || body.trim() === '') fail('block', `the body of ${JSON.stringify(prelude)} is ${typeof body === 'string' ? 'empty' : describe(body)}`, 'a rule holds at least one declaration');
  const lines = body.trim().split('\n');
  return `${text('block', 'the prelude', prelude)} {\n${lines.map((line) => (line ? `  ${line}` : line)).join('\n')}\n}\n`;
}

/** How a non-value reads in a message. */
function describe(given: unknown): string {
  if (given === null || given === undefined || typeof given === 'boolean') return String(given);
  if (Array.isArray(given)) return 'an array';
  return typeof given === 'object' ? 'an object' : `a ${typeof given}`;
}

/** Refuse a key that is not accepted, naming it and the accepted keys. `noun` reads as `option` or `step 2 field`. */
export function known(where: string, noun: string, given: unknown, keys: readonly string[]): void {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) fail(where, `${noun}s are ${describe(given)}`, `give an object with ${keys.join(', ')}`);
  for (const key of Object.keys(given)) if (!keys.includes(key)) fail(where, `${noun} ${JSON.stringify(key)} is not one of ${keys.join(', ')}`, 'drop it, or fix the spelling');
}
