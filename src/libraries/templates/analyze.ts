export type HoleKind = 'text' | 'attribute' | 'attributePart' | 'boolean' | 'property' | 'event' | 'element';

export interface Hole {
  kind: HoleKind;
  /** Attribute, property, or event name. */
  name: string;
  /** Characters to drop from the end of the preceding static string (the `name="` part). */
  trim: number;
  /** Drop the closing quote at the start of the next static string. */
  skipQuote: boolean;
}

const QUOTED = /([@?.]?[^\s"'<>/=]+)\s*=\s*(["'])$/;
const UNQUOTED = /([@?.]?[^\s"'<>/=]+)\s*=\s*$/;
const cache = new WeakMap<TemplateStringsArray, Hole[]>();

/** Work out what each ${} in a template is, from the static HTML around it. Cached per template. */
export function analyze(strings: TemplateStringsArray): Hole[] {
  let holes = cache.get(strings);
  if (holes) return holes;

  holes = [];
  let inTag = false;
  let quote: string | null = null;

  for (let i = 0; i < strings.length - 1; i++) {
    const chunk = strings[i];
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (inTag) {
        if (c === '"' || c === "'") quote = c;
        else if (c === '>') inTag = false;
      } else if (c === '<' && /[a-zA-Z/!]/.test(chunk[j + 1] ?? '')) {
        inTag = true;
      }
    }
    // A whole-value quoted attribute keeps its quote open here; scanning the next chunk closes it.
    holes.push(classify(chunk, strings[i + 1], inTag, quote));
  }

  cache.set(strings, holes);
  return holes;
}

function classify(before: string, after: string, inTag: boolean, quote: string | null): Hole {
  if (!inTag) return { kind: 'text', name: '', trim: 0, skipQuote: false };

  const quoted = quote ? QUOTED.exec(before) : null;
  if (quote && quoted && quoted[2] === quote && after.startsWith(quote)) {
    return withPrefix(quoted[1], quoted[0].length, true);
  }
  if (quote) {
    if (/\s[@?.][^\s"'<>/=]+\s*=\s*["']?[^"']*$/.test(before)) throw new SyntaxError('@, ?, and . bindings must be the whole attribute value');
    return { kind: 'attributePart', name: '', trim: 0, skipQuote: false };
  }

  const unquoted = UNQUOTED.exec(before);
  if (unquoted) return withPrefix(unquoted[1], unquoted[0].length, false);
  return { kind: 'element', name: '', trim: 0, skipQuote: false };
}

function withPrefix(name: string, trim: number, skipQuote: boolean): Hole {
  const kinds: Record<string, HoleKind> = { '@': 'event', '?': 'boolean', '.': 'property' };
  const kind = kinds[name[0]];
  return kind ? { kind, name: name.slice(1), trim, skipQuote } : { kind: 'attribute', name, trim, skipQuote };
}
