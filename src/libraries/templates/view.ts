/** Renders nothing: as text, or as an attribute value (removing the attribute). */
export const nothing: unique symbol = Symbol('nothing');
export type Nothing = typeof nothing;

/** The result of an html`` template: its static strings and the values between them. */
export class ViewResult {
  constructor(
    readonly strings: TemplateStringsArray,
    readonly values: readonly unknown[],
  ) {}
}

/**
 * A template. Values are escaped; positions decide what a value does:
 *
 *   <p>${text}</p>                 text (strings, numbers, nested html``, arrays; nothing/null/false render empty)
 *   <a href=${url}>                attribute (nothing/null remove it)
 *   <p class="toast ${kind}">      part of an attribute
 *   <button ?disabled=${flag}>     boolean attribute
 *   <input .value=${draft}>        DOM property, set after rendering
 *   <button @click=${handler}>     event handler: handler(event, element)
 *   <form ${behavior}>             element behavior, applied after rendering
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): ViewResult {
  return new ViewResult(strings, values);
}

/** Something to do with an element after each render: focus it, open a dialog, fill a form. */
export class ElementBehavior {
  constructor(
    readonly apply: (element: Element) => void,
  ) {}
}

/** Make a behavior: const focus = behavior((el, when: boolean) => …); then <input ${focus(true)}>. */
export function behavior<A extends unknown[]>(fn: (element: Element, ...args: A) => void): (...args: A) => ElementBehavior {
  return (...args) => new ElementBehavior((element) => fn(element, ...args));
}
