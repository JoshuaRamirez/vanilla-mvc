/**
 * The one place CSS text is formatted. Every emitted line is a declaration() or a
 * block(), every comment a comment(), and every value passes text(), so a bad option
 * fails here at compile, not in DevTools: undefined, null, NaN, a non-finite number, an
 * object, or text holding `;`, `{` or `}`. Every throw in the engine is one sentence on
 * one line, thrown by fail(): `effects: <function>: <what>; <fix>`. known() refuses an
 * option key by name with the accepted set. Animation's shape, mirrored.
 */

/** Throw the engine's one sentence. */
export function fail(fn: string, what: string, fix: string): never {
  throw new Error(`effects: ${fn}: ${what}; ${fix}`);
}

/** A value fit for text: a finite number, or a non-empty string with no `;`, `{` or `}`. */
export function text(fn: string, what: string, given: unknown): string {
  if (typeof given === 'number') {
    if (!Number.isFinite(given)) fail(fn, `${what} is ${given}`, 'give a finite number');
    return String(given);
  }
  if (typeof given !== 'string') fail(fn, `${what} is ${kind(given)}`, 'give a string or a finite number');
  if (given.trim() === '') fail(fn, `${what} is empty`, 'give a value, or leave the option out for its default');
  if (/[;{}]/.test(given)) fail(fn, `${what} ${JSON.stringify(given)} holds ";", "{" or "}"`, 'a value is one CSS value; the rule goes around it');
  return given;
}

/** Refuse options that are not an object, or a key that is not an option, naming the options. */
export function known(fn: string, given: unknown, keys: readonly string[]): void {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) fail(fn, `the options are ${kind(given)}`, `give an object with ${keys.join(', ')}`);
  for (const key of Object.keys(given)) if (!keys.includes(key)) fail(fn, `${JSON.stringify(key)} is not an option`, `the options are ${keys.join(', ')}`);
}

/** One line: `name: value;`. */
export function declaration(name: string, value: unknown): string {
  return `${text('declaration', 'the property name', name)}: ${text('declaration', name, value)};`;
}

/** One rule: the prelude, the body indented two spaces, the closing brace and a newline, so blocks concatenate. */
export function block(prelude: string, body: string): string {
  if (typeof body !== 'string' || body.trim() === '') fail('block', `the body of ${JSON.stringify(prelude)} is ${typeof body === 'string' ? 'empty' : kind(body)}`, 'a rule holds at least one declaration');
  const lines = body.trim().split('\n');
  return `${text('block', 'the prelude', prelude)} {\n${lines.map((line) => (line ? `  ${line}` : line)).join('\n')}\n}\n`;
}

/** One comment line, `/* sentence *\/`, which the sheet puts above every rule group. */
export function comment(sentence: string): string {
  if (typeof sentence !== 'string' || sentence.trim() === '') fail('comment', 'the sentence is empty', 'give one sentence');
  if (sentence.includes('*/') || /[{}]/.test(sentence)) fail('comment', `the sentence ${JSON.stringify(sentence)} would close the comment or open a rule`, 'keep "*/", "{" and "}" out of it');
  return `/* ${sentence} */\n`;
}

/** `var(--x, fallback)`: how this engine reads any property, its own or another engine's. */
export function read(property: string, fallback: string): string {
  return `var(${property}, ${fallback})`;
}

/** `calc(<time> * var(--fx-speed, 1))`: every duration this engine emits is scaled by the speed knob. */
export function timed(time: string): string {
  return `calc(${time} * ${read('--fx-speed', '1')})`;
}

function kind(given: unknown): string {
  if (given === null || given === undefined || typeof given === 'boolean') return String(given);
  if (Array.isArray(given)) return 'an array';
  return typeof given === 'object' ? 'an object' : `a ${typeof given}`;
}
