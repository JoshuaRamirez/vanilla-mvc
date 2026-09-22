import { ApplicationElement, NavigationRequested, type RouteMatch } from '../../../framework/index.ts';
import type { EditValues } from '../../events/edit-values.ts';
import { routes } from '../../routes.ts';
import { Notice } from '../communication/notice.ts';
import type { Notices } from '../communication/notices.ts';
import { NotFoundError } from '../server/not-found-error.ts';
import type { ServerRequests } from '../server/server-requests.ts';
import type { TodoApi } from '../server/todo-api.ts';
import { ValidationError } from '../server/validation-error.ts';
import { TodoChanges } from '../todos/todo-changes.ts';
import type { TodoCollection } from '../todos/todo-collection.ts';
import type { WorkDiscarded } from '../work/work-discarded.ts';
import { EditingPublisher } from './editing-publisher.ts';
import { EditSession } from './edit-session.ts';

/**
 * Editing one todo at a time, following the route: load it fresh, take
 * changes, save, revert. Unsaved changes are work at risk. After a save,
 * the user goes back to the list.
 */
export class TodoEditing extends ApplicationElement {
  static readonly workKey = 'todo-edit';

  session: EditSession | null = null;
  readonly #publisher = new EditingPublisher((event) => this.publish(event), TodoEditing.workKey);

  constructor(
    private readonly api: TodoApi,
    private readonly requests: ServerRequests,
    private readonly collection: TodoCollection,
    private readonly notices: Notices,
  ) {
    super();
  }

  protected override onInterconnect(): void {
    this.subscribe<WorkDiscarded>('WorkDiscarded', ({ key }) => key === TodoEditing.workKey && this.revert());
  }

  /** Take up the todo the route names, or close the session. The page asks. */
  follow(route: RouteMatch): Promise<boolean> {
    if (route.name !== 'todo') {
      if (this.session) this.#set(null);
      return Promise.resolve(false);
    }
    const id = Number(route.params.id);
    return this.session?.id === id ? Promise.resolve(false) : this.open(id);
  }

  /** Load the todo fresh from the server. */
  open(id: number): Promise<boolean> {
    this.#set(EditSession.loading(id));
    return this.requests.run(async () => {
      try {
        const todo = await this.api.get(id);
        if (this.session?.id === id) this.#set(EditSession.open(todo));
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        if (this.session?.id === id) this.#set(EditSession.missing(id));
      }
    });
  }

  change(values: EditValues): void {
    if (this.session) this.#set(this.session.change(TodoChanges.of(values)));
  }

  /** The user committed a change to one field: remember it, from and to. */
  noteFieldChange(field: string, previous: unknown, value: unknown): void {
    if (this.session) this.#set(this.session.noteChange({ field, previous, value }));
  }

  async save(): Promise<boolean> {
    const session = this.session;
    if (!session?.canSave || !session.values) return false;
    this.#set(session.startSaving());

    const saved = await this.requests.run(async () => {
      const current = this.session;
      if (!current?.values || current.id !== session.id) return;
      try {
        const list = await this.api.update(current.id, current.values);
        this.collection.receive(list);
        const todo = list.find(current.id);
        if (!todo || this.session?.id !== current.id) return;
        this.#set(this.session.saved(todo));
        this.notices.raise(Notice.saved(todo.title));
        this.publish<NavigationRequested>({ type: 'NavigationRequested', path: routes.href('todos'), replace: false });
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        if (this.session?.id === current.id) this.#set(this.session.reject(error.fields));
      }
    });

    if (!saved && this.session?.saving) this.#set(this.session.fail());
    return saved;
  }

  revert(): void {
    if (this.session) this.#set(this.session.revert());
  }

  #set(session: EditSession | null): void {
    this.session = session;
    this.#publisher.changed(session);
  }
}
