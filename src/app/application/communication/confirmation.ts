import type { Todo } from '../todos/todo.ts';

export type ConfirmationReason = 'delete-todo' | 'clear-completed' | 'discard-changes';

/**
 * A question for the user, asked over the bus, by reason. Whoever asks
 * awaits answer; whoever shows it words it and calls accept() or decline().
 * Answers once.
 */
export class Confirmation {
  readonly answer: Promise<boolean>;
  #resolve!: (confirmed: boolean) => void;
  #answered = false;

  private constructor(
    readonly reason: ConfirmationReason,
    /** What it's about, e.g. a todo's title. */
    readonly subject: string,
    /** How many things it affects. */
    readonly count: number,
  ) {
    this.answer = new Promise((resolve) => (this.#resolve = resolve));
  }

  static deleteTodo(todo: Todo): Confirmation {
    return new Confirmation('delete-todo', todo.title, 1);
  }

  static clearCompleted(count: number): Confirmation {
    return new Confirmation('clear-completed', '', count);
  }

  static discardChanges(count: number): Confirmation {
    return new Confirmation('discard-changes', '', count);
  }

  get isAnswered(): boolean {
    return this.#answered;
  }

  accept(): void {
    this.#respond(true);
  }

  decline(): void {
    this.#respond(false);
  }

  #respond(confirmed: boolean): void {
    if (this.#answered) return;
    this.#answered = true;
    this.#resolve(confirmed);
  }
}
