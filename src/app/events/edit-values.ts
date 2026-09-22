import type { Priority } from './priority.ts';

/** The editable fields of a todo. */
export interface EditValues {
  readonly title: string;
  readonly notes: string;
  readonly priority: Priority;
  readonly due: string | null;
  readonly tags: readonly string[];
  readonly done: boolean;
}
