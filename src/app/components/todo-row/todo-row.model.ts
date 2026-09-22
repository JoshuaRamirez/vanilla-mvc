export interface TodoRowModel {
  id: number;
  title: string;
  done: boolean;
  overdue: boolean;
  highPriority: boolean;
  tags: readonly string[];
  dueLabel: string;
  editHref: string;
  renaming: boolean;
}
