import { analyze } from './analyze.ts';
import { ElementBehavior, nothing, ViewResult } from './view.ts';

export type Handler = (event: Event, element: Element) => unknown;

export type Binding = { kind: 'property'; name: string; value: unknown } | { kind: 'behavior'; behavior: ElementBehavior };

export interface Serialized {
  html: string;
  handlers: Handler[];
  bindings: Binding[];
  /** Event types the markup listens for. */
  events: Set<string>;
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Turn a view into HTML. Handlers and bindings are collected in order and
 * referenced from marker attributes named with prefix, so nested renders
 * with other prefixes never collide. No DOM required.
 */
export function serialize(view: ViewResult, prefix: string): Serialized {
  const out: Serialized = { html: '', handlers: [], bindings: [], events: new Set() };
  write(view, prefix, out);
  return out;
}

function write(view: ViewResult, prefix: string, out: Serialized): void {
  const { strings, values } = view;
  const holes = analyze(strings);

  for (let i = 0; i < strings.length; i++) {
    let chunk = strings[i];
    if (i > 0 && holes[i - 1].skipQuote) chunk = chunk.slice(1);
    if (i < holes.length) chunk = chunk.slice(0, chunk.length - holes[i].trim);
    out.html += chunk;
    if (i < holes.length) fill(holes[i].kind, holes[i].name, values[i], prefix, out);
  }
}

/** Append one value's output. Nested templates append themselves, in order. */
function fill(kind: string, name: string, value: unknown, prefix: string, out: Serialized): void {
  switch (kind) {
    case 'text':
      return text(value, prefix, out);
    case 'attribute':
      if (value !== nothing && value != null) out.html += `${name}="${escape(String(value))}"`;
      return;
    case 'attributePart':
      if (value !== nothing && value != null) out.html += escape(String(value));
      return;
    case 'boolean':
      if (value) out.html += name;
      return;
    case 'event':
      if (value === nothing || value == null) return;
      if (typeof value !== 'function') throw new TypeError(`@${name} needs a function`);
      out.events.add(name);
      out.html += `data-on-${name}="${prefix}:${out.handlers.push(value as Handler) - 1}"`;
      return;
    case 'property':
      out.html += `data-${prefix}-${out.bindings.push({ kind: 'property', name, value }) - 1}`;
      return;
    case 'element':
      if (value === nothing || value == null) return;
      if (!(value instanceof ElementBehavior)) throw new TypeError('Only behaviors can go on an element itself');
      out.html += `data-${prefix}-${out.bindings.push({ kind: 'behavior', behavior: value }) - 1}`;
      return;
  }
  throw new Error(`Unknown hole kind ${kind}`);
}

function text(value: unknown, prefix: string, out: Serialized): void {
  if (value === nothing || value == null || value === false) return;
  if (value instanceof ViewResult) return write(value, prefix, out);
  if (Array.isArray(value)) {
    for (const item of value) text(item, prefix, out);
    return;
  }
  out.html += escape(String(value));
}
