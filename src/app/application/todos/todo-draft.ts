import { ApplicationElement } from '../../../framework/index.ts';
import type { TodoAdded } from '../../events/todo-added.ts';
import type { WorkDiscarded } from '../work/work-discarded.ts';
import { DraftPublisher } from './draft-publisher.ts';
import type { TodoCollection } from './todo-collection.ts';

/** The new todo being written. Unsent text is work at risk; it clears only once the server has the todo. */
export class TodoDraft extends ApplicationElement {
  static readonly workKey = 'todo-draft';

  text = '';
  readonly #publisher = new DraftPublisher((event) => this.publish(event), TodoDraft.workKey);

  constructor(private readonly collection: TodoCollection) {
    super();
  }

  get isEmpty(): boolean {
    return this.text.trim() === '';
  }

  protected override onInterconnect(): void {
    this.subscribe<TodoAdded>('TodoAdded', ({ title }) => this.added(title));
    this.subscribe<WorkDiscarded>('WorkDiscarded', ({ key }) => key === TodoDraft.workKey && this.change(''));
  }

  change(text: string): void {
    this.text = text;
    this.#publisher.changed(text);
  }

  submit(): Promise<boolean> {
    return this.isEmpty ? Promise.resolve(false) : this.collection.add(this.text);
  }

  added(title: string): void {
    if (title.toLowerCase() === this.text.trim().toLowerCase()) this.change('');
  }
}
