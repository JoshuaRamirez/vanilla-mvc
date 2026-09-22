import { morph } from './morph.ts';
import { serialize, type Binding, type Handler } from './serialize.ts';
import type { ViewResult } from './view.ts';

export interface RenderOptions {
  /** Selector for elements whose contents belong to someone else (e.g. child components). */
  boundary?: string;
}

interface Root {
  prefix: string;
  handlers: Handler[];
  listening: Set<string>;
}

/** Events that don't bubble: listen in the capture phase and match only the target. */
const NON_BUBBLING = new Set(['focus', 'blur', 'mouseenter', 'mouseleave', 'load', 'error', 'scroll', 'cancel', 'close', 'toggle', 'invalid']);

const roots = new WeakMap<Element, Root>();
let nextRoot = 0;

/**
 * Render a view into target, updating the DOM in place. Events are
 * delegated: one listener per event type on target. Handlers are called as
 * handler(event, element), nearest element first, like bubbling.
 */
export function render(view: ViewResult, target: Element, options: RenderOptions = {}): void {
  let root = roots.get(target);
  if (!root) roots.set(target, (root = { prefix: `v${nextRoot++}`, handlers: [], listening: new Set() }));

  const { html, handlers, bindings, events } = serialize(view, root.prefix);
  const isBoundary = options.boundary ? (element: Element) => element.matches(options.boundary!) : undefined;

  morph(target, html, { isBoundary });
  root.handlers = handlers;
  listen(target, root, events);
  apply(target, root.prefix, bindings, isBoundary);
}

function listen(target: Element, root: Root, events: Set<string>): void {
  for (const type of events) {
    if (root.listening.has(type)) continue;
    root.listening.add(type);
    target.addEventListener(type, (event) => deliver(target, root, event), NON_BUBBLING.has(type));
  }
}

function deliver(target: Element, root: Root, event: Event): void {
  const attribute = `data-on-${event.type}`;
  const mine = `${root.prefix}:`;
  let element = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement ?? null;
  const onlyTarget = NON_BUBBLING.has(event.type);

  while (element) {
    const marker = element.getAttribute(attribute);
    if (marker?.startsWith(mine)) {
      root.handlers[Number(marker.slice(mine.length))]?.(event, element);
      if (event.cancelBubble) return;
    }
    if (onlyTarget || element === target) return;
    element = element.parentElement;
  }
}

function apply(target: Element, prefix: string, bindings: Binding[], isBoundary?: (element: Element) => boolean): void {
  if (!bindings.length) return;
  const marker = `data-${prefix}-`;
  const visit = (element: Element) => {
    for (const { name } of element.attributes) {
      if (!name.startsWith(marker)) continue;
      const binding = bindings[Number(name.slice(marker.length))];
      if (binding?.kind === 'property') {
        const node = element as unknown as Record<string, unknown>;
        if (node[binding.name] !== binding.value) node[binding.name] = binding.value;
      } else if (binding?.kind === 'behavior') {
        binding.behavior.apply(element);
      }
    }
    if (element !== target && isBoundary?.(element)) return;
    for (const child of element.children) visit(child);
  };
  visit(target);
}
