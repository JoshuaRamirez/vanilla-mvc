import { ApplicationElement } from '../../../framework/index.ts';
import type { ConfirmationAnswered } from '../../events/confirmation-answered.ts';
import type { ConfirmationAsked } from '../../events/confirmation-asked.ts';
import type { Confirmation } from './confirmation.ts';

/**
 * Asking the user questions, one at a time. A question goes out as an event
 * with an id; answer(id, confirmed) settles it. Asking a new question while
 * one is open declines the open one. Capabilities just await.
 */
export class Questions extends ApplicationElement {
  #nextId = 1;
  #open: { id: number; question: Confirmation } | null = null;

  /** Ask, and resolve with the user's answer. */
  ask(question: Confirmation): Promise<boolean> {
    if (this.#open) this.answer(this.#open.id, false);
    const id = this.#nextId++;
    this.#open = { id, question };
    this.publish<ConfirmationAsked>({ type: 'ConfirmationAsked', id, reason: question.reason, subject: question.subject, count: question.count });
    return question.answer;
  }

  answer(id: number, confirmed: boolean): void {
    if (this.#open?.id !== id) return;
    const { question } = this.#open;
    this.#open = null;
    if (confirmed) question.accept();
    else question.decline();
    this.publish<ConfirmationAnswered>({ type: 'ConfirmationAnswered', id, confirmed });
  }
}
