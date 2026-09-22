import type { Todo, TodoPriority } from './todo.ts';

export interface TodoChangesData {
  title: string;
  notes: string;
  priority: TodoPriority;
  due: string | null;
  tags: readonly string[];
  done: boolean;
}

/** Everything an edit can change, as the server accepts it. Immutable. */
export class TodoChanges implements TodoChangesData {
  readonly title: string;
  readonly notes: string;
  readonly priority: TodoPriority;
  readonly due: string | null;
  readonly tags: readonly string[];
  readonly done: boolean;

  private constructor({ title, notes, priority, due, tags, done }: TodoChangesData) {
    this.title = title;
    this.notes = notes;
    this.priority = priority;
    this.due = due;
    this.tags = Object.freeze([...tags]);
    this.done = done;
    Object.freeze(this);
  }

  static of(data: TodoChangesData): TodoChanges {
    return new TodoChanges(data);
  }

  static fromTodo(todo: Todo): TodoChanges {
    return new TodoChanges(todo);
  }

  /** Field names whose values differ from other's. Tags compare as a set. */
  changedFields(other: TodoChanges): string[] {
    const fields = ['title', 'notes', 'priority', 'due', 'tags', 'done'] as const;
    return fields.filter((field) => (field === 'tags' ? !sameSet(this.tags, other.tags) : this[field] !== other[field]));
  }

  equals(other: TodoChanges): boolean {
    return this.changedFields(other).length === 0;
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}
