import { analyze, idOf, type Hole } from './analyze.ts';
import { StyleResult } from './sheet.ts';

/** A custom property to set on the scope element: what a value hole binds to. */
export interface Property {
  name: string;
  value: string;
}

export interface Serialized {
  /** The sheet's name (idOf): the data-css token and the --css-<id>-<n> prefix. */
  id: string;
  /** The plan of the holes: two applies with the same key have the same text. */
  key: string;
  /** The CSS text, with every value hole as var(--css-<id>-<n>). */
  text: string;
  properties: Property[];
}

/** A custom property holding a CSS-wide keyword would apply it to itself, so these stay in the text. */
const KEYWORDS = new Set(['initial', 'inherit', 'unset', 'revert', 'revert-layer']);
const NAME = /^-?-?[a-zA-Z_][\w-]*$/;
/** Every bound property starts here: reserved, so no sheet name can collide with an engine's tokens. */
const PREFIX = '--css-';
/** Distinct texts one call site may take; past it a hole is varying per instance. */
const LIMIT = 64;
const texts = new WeakMap<TemplateStringsArray, Map<string, string>>();

interface Walk {
  /** The outermost sheet: names the properties. */
  id: string;
  /** The sheet the current hole is in: names the error. */
  sheet: string;
  n: number;
  key: string;
  text: string;
  render: boolean;
  properties: Property[];
  /** Blocks open around the sheet being written: what an inlined sheet's own depth adds to. */
  depth: number;
  /** Inside a descriptor at-rule's block, through any nesting: values are text. */
  descriptor: boolean;
}

/**
 * Turn a sheet into CSS text and a binding plan. The walk over the values yields the key and
 * the properties; the text is a function of (strings, key), built once per key per call site.
 * Pure: no DOM. Misuse throws a TypeError naming the sheet and quoting the CSS before the hole.
 */
export function serialize(style: StyleResult): Serialized {
  const id = idOf(style.strings);
  const plan = walk(style, id, false);
  let cache = texts.get(style.strings);
  if (!cache) texts.set(style.strings, (cache = new Map()));
  let text = cache.get(plan.key);
  if (text === undefined) {
    if (cache.size >= LIMIT) {
      throw new TypeError(`css "${id}": ${LIMIT} variants of one call site; this value varies per instance: bind it in a declaration, or give the variants their own css call sites`);
    }
    cache.set(plan.key, (text = walk(style, id, true).text));
  }
  return { id, key: plan.key, text, properties: plan.properties };
}

/** Wrap CSS text so it reaches only [data-css~=token] and its subtree, stopping at the boundary. */
export function scoped(text: string, token: string, boundary?: string): string {
  return `@scope ([data-css~="${token}"])${boundary ? ` to (:scope ${boundary})` : ''} { ${text} }`;
}

/**
 * A declaration block as text: `padding: 4px; --gap: 8;`. For a template's style= attribute, where a
 * per-instance value rides the rendered HTML and the morph keeps it. Empties are omitted, numbers unitless.
 */
export function declarations(block: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [name, value] of Object.entries(block)) {
    if (!NAME.test(name)) throw new TypeError(`css: "${name}" is not a property name`);
    if (empty(value)) continue;
    if (!isText(value)) throw new TypeError(`css: "${name}" needs text or a number, got ${typeof value}`);
    out.push(`${name}: ${String(value)};`);
  }
  return out.join(' ');
}

function walk(style: StyleResult, id: string, render: boolean): Walk {
  const out: Walk = { id, sheet: id, n: 0, key: '', text: '', render, properties: [], depth: 0, descriptor: false };
  write(style, out);
  return out;
}

function write(style: StyleResult, out: Walk): void {
  const { strings, values } = style;
  const holes = analyze(strings);
  const outer = out.sheet;
  out.sheet = idOf(strings);
  for (let i = 0; i < strings.length; i++) {
    if (out.render) out.text += strings[i];
    if (i < holes.length) fill(holes[i], values[i], out);
  }
  out.sheet = outer;
}

function fill(hole: Hole, value: unknown, out: Walk): void {
  switch (hole.kind) {
    case 'value':
      return valueHole(hole, value, out);
    case 'text':
      return textHole(hole, value, out);
    case 'string':
      return stringHole(hole, value, out);
    case 'rule':
      return ruleHole(hole, value, out);
  }
}

/** After `prop:` — bound live, or a CSS-wide keyword written as is; text inside a descriptor at-rule. */
function valueHole(hole: Hole, value: unknown, out: Walk): void {
  if (empty(value)) {
    out.key += '-';
    return;
  }
  if (out.descriptor) return textHole(hole, value, out);
  if (isText(value)) return bind(String(value), out);
  if (value instanceof StyleResult || Array.isArray(value)) fail(hole, out, 'a css block goes at the start of a statement');
  if (typeof value === 'object') fail(hole, out, 'a declaration block goes at the start of a statement');
  fail(hole, out, `${describe(value)} is not a value; holes are values from the model`);
}

function bind(text: string, out: Walk): void {
  const keyword = text.trim().toLowerCase();
  if (KEYWORDS.has(keyword)) {
    out.key += `k${keyword};`;
    if (out.render) out.text += keyword;
    return;
  }
  const name = `${PREFIX}${out.id}-${out.n++}`;
  out.key += 'v';
  out.properties.push({ name, value: text });
  if (out.render) out.text += `var(${name})`;
}

/** In a selector, an at-rule prelude, a property name or a descriptor — verbatim. */
function textHole(hole: Hole, value: unknown, out: Walk): void {
  if (empty(value)) {
    out.key += '-';
    return;
  }
  if (!isText(value)) fail(hole, out, `${describe(value)} cannot go in a selector or a name; only text can`);
  const text = plain(hole, value, out);
  out.key += `t${text.length}:${text}`;
  if (out.render) out.text += text;
}

/** Text that goes into the sheet verbatim: nothing that closes a block, ends a declaration or opens a comment. */
function plain(hole: Hole, value: string | number | bigint, out: Walk): string {
  const text = String(value);
  const bad = /[{};]|\/\*/.exec(text);
  if (bad) fail(hole, out, `"${bad[0]}" cannot go in a selector or a name`);
  return text;
}

/** Inside quotes — escaped. */
function stringHole(hole: Hole, value: unknown, out: Walk): void {
  if (empty(value)) {
    out.key += '-';
    return;
  }
  if (!isText(value)) fail(hole, out, `${describe(value)} cannot go inside quotes; only text can`);
  const text = String(value);
  out.key += `s${text.length}:${text}`;
  if (out.render) out.text += text.replace(/[\\"'\n]/g, (c) => (c === '\n' ? '\\a ' : `\\${c}`));
}

/**
 * At the start of a statement — composition: a nested sheet, an array, raw css text, a declaration
 * block. A block at the top level is `:scope { … }`: the styled element, or `:root` in a document sheet.
 * Inside a descriptor at-rule a block's values are text, since var() is invalid there.
 */
function ruleHole(hole: Hole, value: unknown, out: Walk): void {
  if (empty(value)) {
    out.key += '-';
    return;
  }
  if (value instanceof StyleResult) {
    const { depth, descriptor } = out;
    out.depth += hole.depth;
    out.descriptor ||= hole.descriptor;
    out.key += `n${idOf(value.strings)}(`;
    write(value, out);
    out.key += ')';
    out.depth = depth;
    out.descriptor = descriptor;
    return;
  }
  if (Array.isArray(value)) {
    out.key += '[';
    for (const item of value) ruleHole(hole, item, out);
    out.key += ']';
    return;
  }
  if (isText(value)) {
    const text = String(value);
    const problem = unbalanced(text);
    if (problem) fail(hole, out, `raw css is not self-contained: ${problem}`);
    out.key += `r${text.length}:${text}`;
    if (out.render) out.text += text;
    return;
  }
  if (typeof value !== 'object') fail(hole, out, `${describe(value)} is not css; holes are values from the model`);
  const top = out.depth + hole.depth === 0;
  const descriptor = out.descriptor || hole.descriptor;
  out.key += top ? ':{' : '{';
  if (top && out.render) out.text += ':scope { ';
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!NAME.test(name)) fail(hole, out, `"${name}" is not a property name`);
    if (empty(entry)) continue;
    if (!isText(entry)) fail(hole, out, `${describe(entry)} is not a value for ${name}; holes are values from the model`);
    out.key += `${name}=`;
    if (out.render) out.text += `${name}: `;
    if (descriptor) {
      const text = plain(hole, entry, out);
      out.key += `t${text.length}:${text}`;
      if (out.render) out.text += text;
    } else bind(String(entry), out);
    out.key += ';';
    if (out.render) out.text += '; ';
  }
  out.key += '}';
  if (top && out.render) out.text += '}';
}

/** Why a raw css string does not balance, or null. Braces, parens, brackets, strings and comments all count. */
function unbalanced(text: string): string | null {
  const closers: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
  const open: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return 'an unterminated comment';
      i = end + 1;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      for (; j < text.length && text[j] !== c; j++) if (text[j] === '\\') j++;
      if (j >= text.length) return 'an unterminated string';
      i = j;
    } else if (c in closers) open.push(c);
    else if (c === '}' || c === ')' || c === ']') {
      const opener = open.pop();
      if (opener === undefined || closers[opener] !== c) return `a stray "${c}"`;
    }
  }
  return open.length ? `an unclosed "${open[open.length - 1]}"` : null;
}

function empty(value: unknown): boolean {
  return value == null || value === false;
}

function isText(value: unknown): value is string | number | bigint {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint';
}

function describe(value: unknown): string {
  return typeof value === 'function' ? 'a function' : typeof value === 'object' ? 'an object' : `${typeof value} ${String(value)}`;
}

function fail(hole: Hole, out: Walk, message: string): never {
  throw new TypeError(`css "${out.sheet}" (after "${hole.before}"): ${message}`);
}
