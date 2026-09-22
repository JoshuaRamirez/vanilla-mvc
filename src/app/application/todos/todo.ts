export type TodoPriority = 'low' | 'normal' | 'high';

export interface TodoData {
  id: number;
  title: string;
  notes?: string;
  priority?: TodoPriority;
  due?: string | null;
  tags?: string[];
  done: boolean;
}

/** A todo as the server last described it. Immutable: it travels the bus to many models. */
export class Todo {
  /** Options the server accepts. It still decides. */
  static readonly priorities: readonly TodoPriority[] = ['low', 'normal', 'high'];
  static readonly tags: readonly string[] = ['home', 'work', 'errand', 'urgent'];

  readonly id: number;
  readonly title: string;
  readonly notes: string;
  readonly priority: TodoPriority;
  /** ISO date, YYYY-MM-DD. */
  readonly due: string | null;
  readonly tags: readonly string[];
  readonly done: boolean;

  constructor({ id, title, notes = '', priority = 'normal', due = null, tags = [], done }: TodoData) {
    this.id = id;
    this.title = title;
    this.notes = notes;
    this.priority = priority;
    this.due = due;
    this.tags = Object.freeze([...tags]);
    this.done = done;
    Object.freeze(this);
  }

  get isOpen(): boolean {
    return !this.done;
  }

  get isHighPriority(): boolean {
    return this.priority === 'high';
  }

  /** Overdue when open and due before today (YYYY-MM-DD). */
  isOverdue(today: string): boolean {
    return this.isOpen && this.due !== null && this.due < today;
  }

  /** Titles are unique regardless of case and surrounding whitespace. */
  hasTitle(title: string): boolean {
    return this.title.toLowerCase() === title.trim().toLowerCase();
  }

  /** Case-insensitive search over title, notes, and tags. An empty query matches. */
  matches(query: string): boolean {
    const wanted = query.trim().toLowerCase();
    if (!wanted) return true;
    return [this.title, this.notes, ...this.tags].some((text) => text.toLowerCase().includes(wanted));
  }
}
