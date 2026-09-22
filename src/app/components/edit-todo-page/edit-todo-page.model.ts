import type { Priority } from '../../events/priority.ts';

export interface EditTodoPageModel {
  listHref: string;
  loading: boolean;
  missing: boolean;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  saveLabel: string;
  /** What to fill the form with; the same object until the edit starts over. */
  formValues: object | null;
  /** Field name → message. */
  errors: Record<string, string>;
  priorities: readonly Priority[];
  tags: readonly string[];
  lastChangeText: string;
}
