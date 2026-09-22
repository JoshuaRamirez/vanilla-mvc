import type { EditValues } from '../../events/edit-values.ts';
import type { EditingChanged } from '../../events/editing-changed.ts';
import type { Publish } from '../publish.ts';
import type { TodoChanges } from '../todos/todo-changes.ts';
import type { WorkAtRisk } from '../work/work-at-risk.ts';
import type { EditSession } from './edit-session.ts';

/** Announces the edit session as a fact, and whether it is work at risk. */
export class EditingPublisher {
  #baseline: TodoChanges | null = null;
  #revision = 0;

  constructor(
    private readonly publish: Publish,
    private readonly workKey: string,
  ) {}

  changed(session: EditSession | null): void {
    if (session?.baseline !== this.#baseline) {
      this.#baseline = session?.baseline ?? null;
      this.#revision++;
    }
    this.publish<EditingChanged>({
      type: 'EditingChanged',
      id: session?.id ?? null,
      status: session?.status ?? 'closed',
      baseline: values(session?.baseline ?? null),
      revision: this.#revision,
      values: values(session?.values ?? null),
      errors: session?.errors.messages ?? Object.freeze({}),
      dirty: session?.isDirty ?? false,
      saving: session?.saving ?? false,
      canSave: session?.canSave ?? false,
      lastChange: session?.lastChange ?? null,
    });
    this.publish<WorkAtRisk>({ type: 'WorkAtRisk', key: this.workKey, route: 'todo', scope: 'url', atRisk: session?.isDirty ?? false });
  }
}

function values(changes: TodoChanges | null): EditValues | null {
  if (!changes) return null;
  const { title, notes, priority, due, tags, done } = changes;
  return Object.freeze({ title, notes, priority, due, tags, done });
}
