export interface FilterTab {
  label: string;
  href: string;
  active: boolean;
}

export interface TodoListPageModel {
  draft: string;
  canAdd: boolean;
  tabs: FilterTab[];
  query: string;
  loaded: boolean;
  empty: boolean;
  emptyMessage: string;
  /** Keys of the row components to show, in order. */
  rowKeys: string[];
  footerText: string;
  canClearCompleted: boolean;
}
