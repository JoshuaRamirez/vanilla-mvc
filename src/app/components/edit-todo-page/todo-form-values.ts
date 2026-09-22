import type { EditValues } from '../../events/edit-values.ts';
import type { Priority } from '../../events/priority.ts';

/**
 * The edit form's fields, named like its inputs. Translates between what the
 * form holds (strings, '' for no date, a missing unchecked box) and EditValues.
 */
export class TodoFormValues {
  private constructor(
    readonly title: string,
    readonly notes: string,
    readonly priority: string,
    readonly due: string,
    readonly tags: readonly string[],
    readonly done: boolean,
  ) {
    Object.freeze(this);
  }

  static fromValues(values: EditValues): TodoFormValues {
    return new TodoFormValues(values.title, values.notes, values.priority, values.due ?? '', [...values.tags], values.done);
  }

  /** Whatever the form seam read. */
  static fromForm(raw: Record<string, unknown>): TodoFormValues {
    const text = (value: unknown) => (value == null ? '' : String(value));
    const tags = raw.tags == null ? [] : (Array.isArray(raw.tags) ? raw.tags : [raw.tags]).map(String);
    const done = raw.done === true || raw.done === 'true';
    return new TodoFormValues(text(raw.title), text(raw.notes), text(raw.priority) || 'normal', text(raw.due), tags, done);
  }

  toValues(): EditValues {
    return Object.freeze({
      title: this.title.trim(),
      notes: this.notes,
      priority: this.priority as Priority,
      due: this.due || null,
      tags: Object.freeze([...this.tags]),
      done: this.done,
    });
  }
}
