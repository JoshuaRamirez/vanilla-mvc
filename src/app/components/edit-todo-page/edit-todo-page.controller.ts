import { Controller, type FieldChange, type RouteChanged } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { TodoEditing } from '../../application/editing/todo-editing.ts';
import type { EditingChanged } from '../../events/editing-changed.ts';
import type { TodoOptionsListed } from '../../events/todo-options-listed.ts';
import { routes } from '../../routes.ts';
import type { EditTodoPageModel } from './edit-todo-page.model.ts';
import { TodoFormValues } from './todo-form-values.ts';

export class EditTodoPageController extends Controller<EditTodoPageModel, ApplicationDomain> {
  #editing!: TodoEditing;
  #revision = -1;

  protected createModel(): EditTodoPageModel {
    return {
      listHref: routes.href('todos'),
      loading: true,
      missing: false,
      dirty: false,
      saving: false,
      canSave: false,
      saveLabel: 'Save',
      formValues: null,
      errors: {},
      priorities: [],
      tags: [],
      lastChangeText: '',
    };
  }

  protected override onCreate(): void {
    this.#editing = this.domain.editing;
  }

  protected override onInterconnect(): void {
    this.subscribe('RouteChanged', this.#routeChanged);
    this.subscribe('EditingChanged', this.#editingChanged);
    this.subscribe('TodoOptionsListed', this.#todoOptionsListed);
    this.handle('change', this.#change);
    this.handle('fieldChanged', this.#fieldChanged);
    this.handle('save', this.#save);
    this.handle('revert', this.#revert);
  }

  /** This page shows one todo: it asks for the one the route names, and owns the wait. */
  #routeChanged({ route }: RouteChanged): void {
    this.own(this.#editing.follow(route));
  }

  #editingChanged(editing: EditingChanged): void {
    const m = this.model;
    m.loading = editing.status === 'loading' || editing.status === 'closed';
    m.missing = editing.status === 'missing';
    m.dirty = editing.dirty;
    m.saving = editing.saving;
    m.canSave = editing.canSave;
    m.saveLabel = editing.saving ? 'Saving…' : 'Save';
    m.errors = { ...editing.errors };
    m.lastChangeText = editing.lastChange
      ? `${editing.lastChange.field}: ${EditTodoPageController.#describe(editing.lastChange.previous)} → ${EditTodoPageController.#describe(editing.lastChange.value)}`
      : '';
    if (editing.revision !== this.#revision) {
      this.#revision = editing.revision;
      m.formValues = editing.baseline ? TodoFormValues.fromValues(editing.baseline) : null;
    }
    this.changed();
  }

  #todoOptionsListed({ priorities, tags }: TodoOptionsListed): void {
    this.model.priorities = priorities;
    this.model.tags = tags;
    this.changed();
  }

  #change(values: Record<string, unknown>): void {
    this.#editing.change(TodoFormValues.fromForm(values).toValues());
  }

  #fieldChanged({ name, previous, value }: FieldChange): void {
    this.#editing.noteFieldChange(name, previous, value);
  }

  #save(values: Record<string, unknown>): Promise<boolean> {
    this.#change(values);
    return this.#editing.save();
  }

  #revert(): void {
    this.#editing.revert();
  }

  static #describe(value: unknown): string {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    return String(value);
  }
}
