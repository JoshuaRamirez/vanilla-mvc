import type { Priority } from './priority.ts';

/** A todo as event data. */
export interface TodoFact {
  readonly id: number;
  readonly title: string;
  readonly notes: string;
  readonly priority: Priority;
  /** YYYY-MM-DD, or null. */
  readonly due: string | null;
  readonly tags: readonly string[];
  readonly done: boolean;
  /** Open and past due, as of when this was published. */
  readonly overdue: boolean;
}
