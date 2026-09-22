import type { TodoFilterName } from './todo-filter-name.ts';

/** Which todos are being shown: the filter and search chosen, and the ids they select. */
export interface TodosShown {
  readonly type: 'TodosShown';
  readonly filter: TodoFilterName;
  readonly query: string;
  readonly ids: readonly number[];
  readonly loaded: boolean;
  readonly remaining: number;
  readonly completed: number;
}
