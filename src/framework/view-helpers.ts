import { adapters } from './adapters/adapters.ts';
import { deliverIf } from './delivery.ts';
import type { FieldChange } from './seams.ts';

/** What templates call on events: the event, and the element whose @event matched. */
export type EventHandler<E extends Event = Event> = (event: E, element: Element) => unknown;

/** Prevent the default action, then handle: @submit=${prevent(c.save)}. */
export function prevent<E extends Event>(handler: EventHandler<E>): EventHandler<E> {
  return deliverIf<EventHandler<E>>((event, element) => {
    event.preventDefault();
    return handler(event, element);
  }, handler);
}

/**
 * Hand the handler what changed: name, value, and previous value, uniform
 * across input types. On a form, reports the field the event came from.
 *
 *   <select @change=${field(c.priorityChanged)}>   priorityChanged({ value, previous })
 */
export function field(handler: (change: FieldChange) => unknown): EventHandler {
  return deliverIf<EventHandler>((event, element) => {
    const change = adapters.forms.change(event, element);
    return change ? handler(change) : undefined;
  }, handler);
}

/**
 * Hand the handler the whole form's values, read from the DOM through the
 * form seam. Works on the form or any field inside it.
 *
 *   <form @input=${formValues(c.change)} @submit=${prevent(formValues(c.save))}>
 */
export function formValues(handler: (values: Record<string, unknown>) => unknown): EventHandler {
  return deliverIf<EventHandler>((_event, element) => {
    const form = element instanceof HTMLFormElement ? element : (element.closest('form') ?? element);
    return handler(adapters.forms.readForm(form as HTMLElement));
  }, handler);
}

/**
 * Handle specific keys: @keydown=${keys({ Enter: field(c.save), Escape: c.cancel })}.
 * Handled keys have their default action prevented.
 */
export function keys(map: Record<string, EventHandler<KeyboardEvent>>): EventHandler<KeyboardEvent> {
  return deliverIf<EventHandler<KeyboardEvent>>((event, element) => {
    const handler = map[event.key];
    if (!handler) return undefined;
    event.preventDefault();
    return handler(event, element);
  }, ...Object.values(map));
}
