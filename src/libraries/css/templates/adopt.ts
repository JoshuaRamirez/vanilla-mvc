import { scoped, serialize } from './serialize.ts';
import type { StyleResult } from './sheet.ts';

export interface ApplyOptions {
  /** Selector, relative to the scope element, for the elements where its rules stop (e.g. child components' views). */
  boundary?: string;
}

interface Variant {
  sheet: CSSStyleSheet;
  token: string;
}

interface Registry {
  /** One adopted sheet per (id, boundary, key); inert without a token on some element. */
  variants: Map<string, Variant>;
  /** Tokens handed out per id: card, card.1, card.2. */
  counters: Map<string, number>;
  /** Document-scope sheets, one per id, live only while applied. */
  documentSheets: Map<string, { sheet: CSSStyleSheet; text: string }>;
}

interface Applied {
  token: string | null;
  names: string[];
}

const FLOOR = 'css: this browser cannot scope styles; it needs Chrome 118, Safari 17.4 or Firefox 146';
const ATTRIBUTE = 'data-css';

const registries = new WeakMap<Document, Registry>();
const applied = new WeakMap<Document | HTMLElement, Map<string, Applied>>();

/**
 * Make a sheet live on a scope. An element scope gets the sheet's token in data-css and its
 * bound values as custom properties on its style — both re-set on every call, because the morph
 * strips what it did not render. A document scope gets the text unwrapped and the values on <html>.
 */
export function apply(style: StyleResult, scope: Document | HTMLElement, options: ApplyOptions = {}): void {
  const { id, key, text, properties } = serialize(style);
  const doc = scope instanceof Document ? scope : scope.ownerDocument;
  const registry = registryOf(doc);
  const target = scope instanceof Document ? doc.documentElement : scope;

  const token = scope instanceof Document ? documentSheet(registry, doc, id, text) : variant(registry, doc, id, key, text, options.boundary).token;

  let record = applied.get(scope);
  if (!record) applied.set(scope, (record = new Map()));
  const previous = record.get(id);
  if (previous) {
    if (previous.token && previous.token !== token) removeToken(target, previous.token);
    const kept = new Set(properties.map((p) => p.name));
    for (const name of previous.names) if (!kept.has(name)) target.style.removeProperty(name);
  }
  if (token) addToken(target, token);
  for (const { name, value } of properties) {
    if (target.style.getPropertyValue(name) !== value) target.style.setProperty(name, value);
  }
  record.set(id, { token, names: properties.map((p) => p.name) });
}

/** Take back everything applied to a scope: tokens and properties; for a document, its sheets too. */
export function release(scope: Document | HTMLElement): void {
  const record = applied.get(scope);
  if (!record) return;
  const doc = scope instanceof Document ? scope : scope.ownerDocument;
  const target = scope instanceof Document ? doc.documentElement : scope;
  const registry = registries.get(doc);
  for (const [id, { token, names }] of record) {
    if (token) removeToken(target, token);
    for (const name of names) target.style.removeProperty(name);
    const live = scope instanceof Document ? registry?.documentSheets.get(id) : undefined;
    if (live) {
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== live.sheet);
      registry!.documentSheets.delete(id);
    }
  }
  applied.delete(scope);
}

function registryOf(doc: Document): Registry {
  let registry = registries.get(doc);
  if (registry) return registry;
  probe(doc);
  registries.set(doc, (registry = { variants: new Map(), counters: new Map(), documentSheets: new Map() }));
  return registry;
}

/** Once per document: constructed sheets, adoptedStyleSheets and @scope with a limit must all work. */
function probe(doc: Document): void {
  let ok = false;
  try {
    if ('adoptedStyleSheets' in doc) {
      const sheet = newSheet(doc);
      sheet.replaceSync('@scope (.a) to (.b) { .c { color: red } }');
      ok = sheet.cssRules.length === 1;
    }
  } catch {
    ok = false;
  }
  if (!ok) throw new Error(FLOOR);
}

function newSheet(doc: Document): CSSStyleSheet {
  return new (doc.defaultView ?? window).CSSStyleSheet();
}

function variant(registry: Registry, doc: Document, id: string, key: string, text: string, boundary: string | undefined): Variant {
  const lookup = `${id}\n${boundary ?? ''}\n${key}`;
  let found = registry.variants.get(lookup);
  if (found) return found;
  const count = registry.counters.get(id) ?? 0;
  const token = count ? `${id}.${count}` : id;
  const sheet = newSheet(doc);
  sheet.replaceSync(scoped(text, token, boundary));
  if (sheet.cssRules.length !== 1) throw new Error(`css "${id}": the rules do not parse as one scoped block`);
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  registry.variants.set(lookup, (found = { sheet, token }));
  registry.counters.set(id, count + 1);
  return found;
}

/** One live sheet per id on the document, its text replaced in place when it changes. No token. */
function documentSheet(registry: Registry, doc: Document, id: string, text: string): null {
  let live = registry.documentSheets.get(id);
  if (!live) {
    const sheet = newSheet(doc);
    sheet.replaceSync(text);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    registry.documentSheets.set(id, (live = { sheet, text }));
  } else if (live.text !== text) {
    live.sheet.replaceSync(text);
    live.text = text;
  }
  return null;
}

function addToken(element: HTMLElement, token: string): void {
  const tokens = tokensOf(element);
  if (tokens.includes(token)) return;
  element.setAttribute(ATTRIBUTE, [...tokens, token].join(' '));
}

function removeToken(element: HTMLElement, token: string): void {
  const tokens = tokensOf(element).filter((t) => t !== token);
  if (tokens.length) element.setAttribute(ATTRIBUTE, tokens.join(' '));
  else element.removeAttribute(ATTRIBUTE);
}

function tokensOf(element: HTMLElement): string[] {
  const value = element.getAttribute(ATTRIBUTE);
  return value ? value.split(' ').filter(Boolean) : [];
}
