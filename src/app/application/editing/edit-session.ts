import type { FieldChanged } from '../../events/field-changed.ts';
import { FieldErrors } from '../server/field-errors.ts';
import { TodoChanges } from '../todos/todo-changes.ts';
import type { Todo } from '../todos/todo.ts';

export type EditStatus = 'loading' | 'open' | 'missing';

interface Parts {
  id: number;
  status: EditStatus;
  original: Todo | null;
  baseline: TodoChanges | null;
  values: TodoChanges | null;
  errors: FieldErrors;
  saving: boolean;
  lastChange: FieldChanged | null;
}

/**
 * One todo being edited: the todo as loaded, the changes it started from,
 * the changes so far, the server's objections, whether a save is in flight,
 * and the last field the user changed. Immutable; every step returns a new session.
 */
export class EditSession implements Parts {
  readonly id: number;
  readonly status: EditStatus;
  readonly original: Todo | null;
  readonly baseline: TodoChanges | null;
  readonly values: TodoChanges | null;
  readonly errors: FieldErrors;
  readonly saving: boolean;
  readonly lastChange: FieldChanged | null;

  private constructor(parts: Parts) {
    this.id = parts.id;
    this.status = parts.status;
    this.original = parts.original;
    this.baseline = parts.baseline;
    this.values = parts.values;
    this.errors = parts.errors;
    this.saving = parts.saving;
    this.lastChange = parts.lastChange;
    Object.freeze(this);
  }

  static loading(id: number): EditSession {
    return new EditSession({ id, status: 'loading', original: null, baseline: null, values: null, errors: FieldErrors.none, saving: false, lastChange: null });
  }

  static missing(id: number): EditSession {
    return new EditSession({ ...EditSession.loading(id), status: 'missing' });
  }

  static open(todo: Todo): EditSession {
    const changes = TodoChanges.fromTodo(todo);
    return new EditSession({ id: todo.id, status: 'open', original: todo, baseline: changes, values: changes, errors: FieldErrors.none, saving: false, lastChange: null });
  }

  get isOpen(): boolean {
    return this.status === 'open';
  }

  get isDirty(): boolean {
    return this.values !== null && this.baseline !== null && !this.values.equals(this.baseline);
  }

  get canSave(): boolean {
    return this.isOpen && this.isDirty && !this.saving;
  }

  /** New values. Objections to fields that just changed are dropped. */
  change(values: TodoChanges): EditSession {
    if (!this.isOpen || !this.values) return this;
    return this.#with({ values, errors: this.errors.without(values.changedFields(this.values)) });
  }

  noteChange(change: FieldChanged): EditSession {
    return this.isOpen ? this.#with({ lastChange: change }) : this;
  }

  startSaving(): EditSession {
    return this.#with({ saving: true });
  }

  reject(errors: FieldErrors): EditSession {
    return this.#with({ errors, saving: false });
  }

  /** The save didn't reach a verdict (server failure); keep the edits. */
  fail(): EditSession {
    return this.#with({ saving: false });
  }

  /** Saved: the saved todo is the new starting point. */
  saved(todo: Todo): EditSession {
    return EditSession.open(todo);
  }

  /** Back to the todo as loaded. */
  revert(): EditSession {
    return this.original ? EditSession.open(this.original) : this;
  }

  #with(parts: Partial<Parts>): EditSession {
    return new EditSession({ ...this, ...parts });
  }
}
