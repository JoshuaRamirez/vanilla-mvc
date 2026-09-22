import type { TodoFact } from './todo-fact.ts';

/** Every todo, as the server last described them. */
export interface TodosListed {
  readonly type: 'TodosListed';
  readonly todos: readonly TodoFact[];
  readonly remaining: number;
  readonly completed: number;
}
