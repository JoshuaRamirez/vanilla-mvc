import type { EditValues } from './edit-values.ts';
import type { FieldChanged } from './field-changed.ts';

/** The edit in progress. revision increases whenever the edit starts over (opened, reverted, saved): time to refill a form. */
export interface EditingChanged {
  readonly type: 'EditingChanged';
  readonly id: number | null;
  readonly status: 'closed' | 'loading' | 'open' | 'missing';
  readonly baseline: EditValues | null;
  readonly revision: number;
  readonly values: EditValues | null;
  readonly errors: Readonly<Record<string, string>>;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly canSave: boolean;
  readonly lastChange: FieldChanged | null;
}
