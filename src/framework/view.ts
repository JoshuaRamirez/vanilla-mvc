import { adapters } from './adapters/adapters.ts';
import type { ElementBehaviorResult, ViewResult } from './seams.ts';

/** Renders nothing: as text it is empty, as an attribute value it removes the attribute. */
export const nothing = null;

/**
 * A view template, built by the installed renderer. Values are escaped; the
 * position of each ${} decides what it does (see README: Templates).
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): ViewResult {
  return adapters.renderer.html(strings, values);
}

/** Make an element behavior: const focus = behavior((el, when: boolean) => …); then <input ${focus(true)}>. */
export function behavior<A extends unknown[]>(fn: (element: Element, ...args: A) => void): (...args: A) => ElementBehaviorResult {
  return (...args) => adapters.renderer.behavior((element) => fn(element, ...args));
}
