export type HoleKind = 'rule' | 'text' | 'value' | 'string';

export interface Hole {
  kind: HoleKind;
  /** The static CSS just before the hole, for messages. */
  before: string;
  /** Open blocks around the hole in this sheet's own text: 0 at the top level. */
  depth: number;
  /** Inside a descriptor at-rule's block, where var() is invalid and a bound value is written as text. */
  descriptor: boolean;
}

/** At-rules whose declarations are descriptors: var() is invalid there, so a value hole is text. */
const DESCRIPTOR = /^\s*@(font-face|property|counter-style|page|font-palette-values)\b/i;
const URL = /(^|[^\w-])url\s*$/i;
const IDENT = /^(?:\s|\/\*[\s\S]*?\*\/)*(?:--|::|[.#:@[])?([a-zA-Z_][\w-]*)/;
const CLASS = /\.([a-zA-Z_][\w-]*)/;
const NOISE = /\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\([^)]*\)/g;

const cache = new WeakMap<TemplateStringsArray, Hole[]>();
const ids = new WeakMap<TemplateStringsArray, string>();
const taken = new Set<string>();

/**
 * A sheet's name: the first class in its static text (`:scope { } .title { }` → title), else its
 * first identifier (`:root` → root, `@font-face` → font-face), else `style`; unique per module with
 * a counter suffix. Cosmetic — it names the token in data-css and the bound properties, so the
 * element in DevTools points back at the file; everything keys on the strings themselves.
 */
export function idOf(strings: TemplateStringsArray): string {
  let id = ids.get(strings);
  if (id) return id;
  const base = (CLASS.exec(strings.join(' ').replace(NOISE, ' '))?.[1] ?? IDENT.exec(strings[0])?.[1])?.replace(/-+$/, '') || 'style';
  id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
  taken.add(id);
  ids.set(strings, id);
  return id;
}

/** Work out what each ${} in a sheet is, from the static CSS around it. Cached per call site. */
export function analyze(strings: TemplateStringsArray): Hole[] {
  let holes = cache.get(strings);
  if (holes) return holes;
  const id = idOf(strings);
  holes = [];

  let depth = 0;
  let opened = 0;
  let closed = 0;
  let paren = 0;
  let url: number | null = null; // paren depth an unquoted url( opened at
  let quote: string | null = null;
  let comment = false;
  let statement = ''; // static text since the last ; { or } at paren depth 0
  let colon = false; // the statement saw a : at paren depth 0
  const blocks: boolean[] = []; // per open brace: a descriptor at-rule's block?

  for (let i = 0; i < strings.length; i++) {
    const chunk = strings[i];
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      if (comment) {
        if (c === '*' && chunk[j + 1] === '/') {
          comment = false;
          j++;
        }
        continue;
      }
      if (quote) {
        if (c === '\\') j++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '/' && chunk[j + 1] === '*') {
        comment = true;
        j++;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        continue;
      }
      if (c === '(') {
        if (url === null && URL.test(statement)) url = paren;
        paren++;
      } else if (c === ')') {
        paren = Math.max(0, paren - 1);
        if (url === paren) url = null;
      } else if (paren === 0) {
        if (c === '{') {
          depth++;
          opened++;
          blocks.push(DESCRIPTOR.test(statement));
          statement = '';
          colon = false;
          continue;
        }
        if (c === '}' || c === ';') {
          if (c === '}') {
            depth--;
            closed++;
            blocks.pop();
          }
          statement = '';
          colon = false;
          continue;
        }
        if (c === ':') colon = true;
      }
      statement += c;
    }

    if (i === strings.length - 1) break;
    const before = chunk.slice(-24).replace(/\s+/g, ' ');
    const fail = (message: string): never => {
      throw new TypeError(`css "${id}" (after "${before}"): ${message}`);
    };
    if (comment) fail('a hole inside a comment does nothing');
    const descriptor = blocks[blocks.length - 1] ?? false;
    const at = (kind: HoleKind): Hole => ({ kind, before, depth, descriptor });
    if (quote) holes.push(at('string'));
    else if (/^\s*$/.test(statement)) holes.push(at('rule'));
    else if (url !== null) fail('quote it: url("${…}")');
    else if (terminator(strings, i, paren) === '{') holes.push(at('text'));
    else holes.push(at(colon && !descriptor ? 'value' : 'text'));
  }

  if (quote) throw new TypeError(`css "${id}": an unterminated string`);
  if (comment) throw new TypeError(`css "${id}": an unterminated comment`);
  if (depth !== 0) throw new TypeError(`css "${id}": braces do not balance (${opened} opened, ${closed} closed)`);

  cache.set(strings, holes);
  return holes;
}

/** The first ; { or } at paren depth 0 after hole i, looking through the holes; null at the end. */
function terminator(strings: TemplateStringsArray, i: number, paren: number): string | null {
  let quote: string | null = null;
  let comment = false;
  for (let k = i + 1; k < strings.length; k++) {
    const chunk = strings[k];
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      if (comment) {
        if (c === '*' && chunk[j + 1] === '/') {
          comment = false;
          j++;
        }
      } else if (quote) {
        if (c === '\\') j++;
        else if (c === quote) quote = null;
      } else if (c === '/' && chunk[j + 1] === '*') {
        comment = true;
        j++;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '(') paren++;
      else if (c === ')') paren = Math.max(0, paren - 1);
      else if (paren === 0 && (c === ';' || c === '{' || c === '}')) return c;
    }
  }
  return null;
}
