export interface MorphOptions {
  /** Elements whose children belong to someone else: matched and kept, never descended into. */
  isBoundary?: (element: Element) => boolean;
}

/**
 * Update target's children in place to match html. Elements are matched by
 * data-key, data-component, or id when present, otherwise by tag in order.
 * Matched elements keep their identity, so focus, caret, scroll, and typed
 * values survive.
 */
export function morph(target: Element, html: string, options: MorphOptions = {}): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  morphChildren(target, template.content, options);
}

function keyOf(node: Node): string | null {
  if (!(node instanceof Element)) return null;
  return node.getAttribute('data-key') ?? node.getAttribute('data-component') ?? (node.id || null);
}

function morphChildren(from: ParentNode & Node, to: ParentNode & Node, options: MorphOptions): void {
  const oldNodes = [...from.childNodes];
  const keyed = new Map<string, Node>();
  for (const node of oldNodes) {
    const key = keyOf(node);
    if (key !== null) keyed.set(`${node.nodeName}:${key}`, node);
  }

  const used = new Set<Node>();
  const newNodes = [...to.childNodes];
  let cursor = 0;

  newNodes.forEach((incoming, index) => {
    let match: Node | undefined;
    const key = keyOf(incoming);
    if (key !== null) {
      match = keyed.get(`${incoming.nodeName}:${key}`);
      if (match && used.has(match)) match = undefined;
    } else {
      for (let j = cursor; j < oldNodes.length; j++) {
        const candidate = oldNodes[j];
        if (!used.has(candidate) && keyOf(candidate) === null && candidate.nodeName === incoming.nodeName) {
          match = candidate;
          cursor = j + 1;
          break;
        }
      }
    }

    const current = from.childNodes[index] ?? null;
    if (match) {
      used.add(match);
      update(match, incoming, options);
      if (match !== current) from.insertBefore(match, current);
    } else {
      from.insertBefore(incoming, current);
    }
  });

  while (from.childNodes.length > newNodes.length) from.removeChild(from.lastChild!);
}

function update(existing: Node, incoming: Node, options: MorphOptions): void {
  if (!(existing instanceof Element) || !(incoming instanceof Element)) {
    if (existing.nodeValue !== incoming.nodeValue) existing.nodeValue = incoming.nodeValue;
    return;
  }
  for (const { name } of [...existing.attributes]) {
    if (!incoming.hasAttribute(name)) existing.removeAttribute(name);
  }
  for (const { name, value } of incoming.attributes) {
    if (existing.getAttribute(name) !== value) existing.setAttribute(name, value);
  }
  if (options.isBoundary?.(existing)) return;
  morphChildren(existing, incoming, options);
}
