import { adapters } from './adapters/adapters.ts';
import { behavior } from './view.ts';

const filled = new WeakMap<Element, object>();
const focused = new WeakMap<Element, boolean>();
const written = new WeakMap<Element, Set<string>>();

/**
 * Fill an uncontrolled form from an object by field name. Refills only when
 * given a different object, so the user's edits are left alone.
 *
 *   <form ${fill(m.edit.baseline)} @input=${formValues(c.change)}>
 */
export const fill = behavior((element, values: object) => {
  if (filled.get(element) === values) return;
  filled.set(element, values);
  adapters.forms.writeForm(element as HTMLElement, { ...values });
  adapters.forms.remember(element as HTMLElement, true); // filled values are the new "previous"
});

/** Focus (and select) the element when the condition becomes true. */
export const focus = behavior((element, when: boolean) => {
  if (when && !focused.get(element)) {
    (element as HTMLElement).focus();
    (element as HTMLInputElement).select?.();
  }
  focused.set(element, when);
});

/**
 * Open a native <dialog> as a modal while the condition is true. Judged by
 * :modal, not by the open attribute: a render's morph strips the open that
 * showModal() set, which hides a modal dialog and makes close() do nothing,
 * so a modal dialog gets it back first.
 */
export const modal = behavior((element, open: boolean) => {
  const dialog = element as HTMLDialogElement;
  const shown = dialog.matches(':modal');
  if (shown && !dialog.hasAttribute('open')) dialog.setAttribute('open', '');
  if (open && !shown) dialog.showModal();
  else if (!open && shown) dialog.close();
});

/**
 * Write a record of attributes onto the element: each own key is an
 * attribute, true as an empty value, false, null and undefined removed,
 * anything else as its string. A key this wrote before and the record no
 * longer has is removed. Not an engine's `attributes`, which lists names.
 *
 *   <article ${attrs(cardAttributes({ selected: m.current, elevation: 2 }))}>
 */
export const attrs = behavior((element, record: object) => {
  const now = new Set<string>();
  for (const [name, value] of Object.entries(record)) {
    if (value === false || value === null || value === undefined) {
      element.removeAttribute(name);
      continue;
    }
    const text = value === true ? '' : String(value);
    if (element.getAttribute(name) !== text) element.setAttribute(name, text);
    now.add(name);
  }
  for (const name of written.get(element) ?? []) if (!now.has(name)) element.removeAttribute(name);
  written.set(element, now);
});
