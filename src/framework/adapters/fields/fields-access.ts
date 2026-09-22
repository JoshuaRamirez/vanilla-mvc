import { FieldTracker, readField, readForm, writeField, writeForm } from '../../../libraries/fields/index.ts';
import type { FieldChange, FormField, IFormAccess } from '../../seams.ts';

/** IFormAccess on libraries/fields. */
export class FieldsAccess implements IFormAccess {
  readonly #tracker = new FieldTracker();

  readForm(container: HTMLElement): Record<string, unknown> {
    return readForm(container);
  }

  writeForm(container: HTMLElement, values: Record<string, unknown>): void {
    writeForm(container, values);
  }

  readField(field: FormField): unknown {
    return readField(field);
  }

  writeField(field: FormField, value: unknown): void {
    writeField(field, value);
  }

  remember(container: HTMLElement, force = false): void {
    this.#tracker.remember(container, force);
  }

  change(event: Event, element: Element): FieldChange | null {
    const field = FieldTracker.fieldFor(event, element);
    return field ? this.#tracker.change(field, event) : null;
  }
}
