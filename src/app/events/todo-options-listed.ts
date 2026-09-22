import type { Priority } from './priority.ts';

/** The choices the application accepts for a todo. */
export interface TodoOptionsListed {
  readonly type: 'TodoOptionsListed';
  readonly priorities: readonly Priority[];
  readonly tags: readonly string[];
}
