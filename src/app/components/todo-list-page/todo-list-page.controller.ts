import { Controller, type FieldChange } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import { TodoBrowsing } from '../../application/todos/todo-browsing.ts';
import type { TodoCollection } from '../../application/todos/todo-collection.ts';
import type { TodoDraft } from '../../application/todos/todo-draft.ts';
import type { BusyChanged } from '../../events/busy-changed.ts';
import type { DraftChanged } from '../../events/draft-changed.ts';
import type { TodoFilterName } from '../../events/todo-filter-name.ts';
import type { TodosListed } from '../../events/todos-listed.ts';
import type { TodosShown } from '../../events/todos-shown.ts';
import type { TodoListPageComponent } from './todo-list-page.component.ts';
import type { TodoListPageModel } from './todo-list-page.model.ts';

const TABS: { filter: TodoFilterName; label: string }[] = [
  { filter: 'all', label: 'All' },
  { filter: 'active', label: 'Active' },
  { filter: 'completed', label: 'Completed' },
];

export class TodoListPageController extends Controller<TodoListPageModel, ApplicationDomain> {
  #todos!: TodoCollection;
  #browsing!: TodoBrowsing;
  #draft!: TodoDraft;
  #busy = false;
  #completed = 0;

  protected createModel(): TodoListPageModel {
    return {
      draft: '',
      canAdd: true,
      tabs: TABS.map(({ filter, label }) => ({ label, href: TodoBrowsing.href(filter, ''), active: filter === 'all' })),
      query: '',
      loaded: false,
      empty: true,
      emptyMessage: 'Nothing here.',
      rowKeys: [],
      footerText: '',
      canClearCompleted: false,
    };
  }

  protected override onCreate(): void {
    this.#todos = this.domain.collection;
    this.#browsing = this.domain.browsing;
    this.#draft = this.domain.draft;
  }

  protected override onInterconnect(): void {
    this.subscribe('TodosListed', this.#todosListed);
    this.subscribe('TodosShown', this.#todosShown);
    this.subscribe('BusyChanged', this.#busyChanged);
    this.subscribe('DraftChanged', this.#draftChanged);
    this.handle('changeDraft', this.#changeDraft);
    this.handle('add', this.#add);
    this.handle('search', this.#search);
    this.handle('clearCompleted', this.#clearCompleted);
  }

  #todosListed(listed: TodosListed): void {
    // Rows added or removed change the placeholders this view renders.
    if ((this.component as TodoListPageComponent).syncRows(listed)) this.changed();
  }

  #todosShown(shown: TodosShown): void {
    const m = this.model;
    m.tabs = TABS.map(({ filter, label }) => ({ label, href: TodoBrowsing.href(filter, shown.query), active: filter === shown.filter }));
    m.query = shown.query;
    m.loaded = shown.loaded;
    m.rowKeys = shown.ids.map((id) => `todo-row-${id}`);
    m.empty = shown.ids.length === 0;
    m.emptyMessage = shown.query ? `Nothing matches “${shown.query}”.` : 'Nothing here.';
    m.footerText = `${shown.remaining} left · double-click a title to rename`;
    this.#completed = shown.completed;
    this.#refreshButtons();
    this.changed();
  }

  #busyChanged({ busy }: BusyChanged): void {
    this.#busy = busy;
    this.#refreshButtons();
    this.changed();
  }

  #draftChanged({ text }: DraftChanged): void {
    this.model.draft = text;
    this.changed();
  }

  #changeDraft({ value }: FieldChange): void {
    this.#draft.change(String(value));
  }

  #add(): Promise<boolean> {
    return this.#draft.submit();
  }

  #search({ value }: FieldChange): void {
    this.#browsing.search(String(value));
  }

  #clearCompleted(): Promise<boolean> {
    return this.#todos.clearCompleted();
  }

  #refreshButtons(): void {
    this.model.canAdd = !this.#busy;
    this.model.canClearCompleted = this.#completed > 0 && !this.#busy;
  }
}
