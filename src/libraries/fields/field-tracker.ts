import { isField, isGrouped, keyOf, readDefault, readField, scopeOf, type FormField } from './field-values.ts';

/** A field's value changed: what it is now, and what it was. */
export interface FieldChange {
  /** Field name without a trailing [] ('' when unnamed). */
  name: string;
  value: unknown;
  previous: unknown;
  field: FormField;
  event: Event | null;
}

/**
 * Remembers each field's last known value so a change can report both the
 * new value and the previous one. Groups (radios, checkbox groups) are
 * remembered as one value. Everything is held weakly: removed fields are
 * forgotten with their elements.
 */
export class FieldTracker {
  #single = new WeakMap<FormField, unknown>();
  #groups = new WeakMap<object, Map<string, unknown>>();

  /** Record current values as the baseline. Without force, only fields not yet known. */
  remember(container: ParentNode, force = false): void {
    const fields = container.querySelectorAll<FormField>('input, select, textarea');
    for (const field of fields) {
      if (field instanceof HTMLInputElement && (field.type === 'submit' || field.type === 'button')) continue;
      if (force || !this.#has(field)) this.#set(field, readField(field));
    }
  }

  /** The change a field just went through. Records the new value as the next previous. */
  change(field: FormField, event: Event | null = null): FieldChange {
    const value = readField(field);
    const previous = this.#has(field) ? this.#get(field) : readDefault(field);
    this.#set(field, value);
    return { name: keyOf(field.name), value, previous, field, event };
  }

  /** The field an event is about: the target when it is a field, otherwise the given element. */
  static fieldFor(event: Event, element: Element): FormField | null {
    if (isField(event.target)) return event.target;
    return isField(element) ? element : null;
  }

  #has(field: FormField): boolean {
    return isGrouped(field) ? (this.#groups.get(scopeOf(field))?.has(field.name) ?? false) : this.#single.has(field);
  }

  #get(field: FormField): unknown {
    return isGrouped(field) ? this.#groups.get(scopeOf(field))?.get(field.name) : this.#single.get(field);
  }

  #set(field: FormField, value: unknown): void {
    if (!isGrouped(field)) {
      this.#single.set(field, value);
      return;
    }
    const scope = scopeOf(field);
    let names = this.#groups.get(scope);
    if (!names) this.#groups.set(scope, (names = new Map()));
    names.set(field.name, value);
  }
}
