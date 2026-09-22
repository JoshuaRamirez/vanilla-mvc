/**
 * Text helpers and the told-when-wrong guards. Every function that returns CSS
 * builds it from declarations() and block(), and returns it through checked().
 * Every message is `theme: <fn>: <what>; <fix>`: ThemeError adds the engine.
 */

/** A bad option or value, thrown at the call site. The message names the engine, the function, the field and the rule. */
export class ThemeError extends Error {
  constructor(message: string) {
    super(message.startsWith('theme: ') ? message : `theme: ${message}`);
    this.name = 'ThemeError';
  }
}

const FORBIDDEN = /[;{}]/;

/** A value fit for one declaration: a non-empty string or a finite number, with no `;`, `{` or `}`. */
export function value(where: string, field: string, given: unknown): string {
  if (typeof given === 'number') {
    if (!Number.isFinite(given)) throw new ThemeError(`${where}: ${field} must be a finite number; got ${given}`);
    return String(given);
  }
  if (typeof given !== 'string') throw new ThemeError(`${where}: ${field} must be a non-empty string; got ${describe(given)}`);
  if (given === '') throw new ThemeError(`${where}: ${field} is "" — omit the key or pass undefined to leave the token alone`);
  if (FORBIDDEN.test(given)) {
    throw new ThemeError(`${where}: ${field} is ${JSON.stringify(given)} — a value may not contain ";", "{" or "}"; data goes through a css hole, not into a declaration`);
  }
  return given;
}

/** A selector fit to open a rule: a non-empty string with no braces or semicolons. */
export function selector(where: string, given: unknown): string {
  if (typeof given !== 'string' || given.trim() === '' || FORBIDDEN.test(given)) {
    throw new ThemeError(`${where}: selector must be CSS selector text, like ':root' or '.promo'; got ${describe(given)}`);
  }
  return given.trim();
}

/**
 * An options object with no key outside `accepted`: an unknown key is refused by name with the
 * accepted keys, so a typo or last round's word (`scope`, now `selector`) cannot be ignored silently.
 * `field` names a nested options object (`space`, `fonts`); undefined means the call's own options.
 */
export function options<T extends object>(where: string, given: unknown, accepted: readonly string[], field?: string): T {
  if (given === undefined) return {} as T;
  const what = field ? `${field}` : 'options';
  if (typeof given !== 'object' || given === null || Array.isArray(given)) throw new ThemeError(`${where}: ${what} must be an object; got ${describe(given)}`);
  for (const key of Object.keys(given)) {
    if (accepted.includes(key)) continue;
    const name = field ? `${field}.${key}` : `"${key}"`;
    const hint = key === 'scope' && !field ? ' — the rule\'s selector is the option named selector' : '';
    throw new ThemeError(`${where}: ${name} is not an option${hint}; ${what} keys are ${accepted.join(', ')}`);
  }
  return given as T;
}

/** Declarations from a record, one per line, unindented: "--a: b;\n". Keys are the property names. */
export function declarations(where: string, record: Readonly<Record<string, string | number>>): string {
  let out = '';
  for (const [name, given] of Object.entries(record)) out += `${name}: ${value(where, name, given)};\n`;
  return out;
}

/** The record with every key `set` also names replaced by the pin — theme({ set }) reaches into a block this way; keys `set` has that the record lacks are ignored. */
export function pinned(record: Readonly<Record<string, string>>, set: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const out: Record<string, string> = { ...record };
  if (set) for (const name of Object.keys(out)) if (Object.hasOwn(set, name)) out[name] = set[name] as string;
  return out;
}

/** One rule: the selector, then the declarations indented by two spaces. */
export function block(selector: string, declarations: string): string {
  return `${selector} {\n${declarations.replace(/^(?=.)/gm, '  ')}}\n`;
}

const SMELLS = ['undefined', 'NaN', '[object Object]'] as const;

/** The last net: no undefined, NaN or [object Object] in the text, and braces balance. Quotes the offending line. */
export function checked(where: string, text: string): string {
  for (const smell of SMELLS) {
    const at = text.indexOf(smell);
    if (at !== -1) throw new ThemeError(`${where}: output contains "${smell}" at "${lineAt(text, at)}"; a value was not checked — report it`);
  }
  let depth = 0;
  for (const char of text) {
    if (char === '{') depth++;
    else if (char === '}' && --depth < 0) break;
  }
  if (depth !== 0) throw new ThemeError(`${where}: output's braces do not balance; a selector or value carried a brace — report it`);
  return text;
}

/** A CSS length as its number and unit: parseLength('0.25rem') → { n: 0.25, unit: 'rem' }; null when it is not one. */
export function parseLength(text: string): { readonly n: number; readonly unit: string } | null {
  const match = /^\s*(-?(?:\d+\.?\d*|\.\d+))([a-z%]+)\s*$/i.exec(text);
  return match ? { n: Number(match[1]), unit: match[2] } : null;
}

/** A number as CSS text: at most `decimals` places, no trailing zeros, never "-0". */
export function number(n: number, decimals: number): string {
  const text = String(Number(n.toFixed(decimals)));
  return text === '-0' ? '0' : text;
}

export function describe(given: unknown): string {
  if (typeof given === 'string') return JSON.stringify(given);
  if (given === null || given === undefined || typeof given === 'number' || typeof given === 'boolean') return String(given);
  if (Array.isArray(given)) return `[${given.map(describe).join(', ')}]`;
  return typeof given === 'object' ? `{${Object.keys(given).join(', ')}}` : typeof given;
}

function lineAt(text: string, at: number): string {
  const start = text.lastIndexOf('\n', at) + 1;
  const end = text.indexOf('\n', at);
  return text.slice(start, end === -1 ? undefined : end).trim();
}
