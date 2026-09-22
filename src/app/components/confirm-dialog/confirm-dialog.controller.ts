import { Controller } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { Questions } from '../../application/communication/questions.ts';
import type { ConfirmationAnswered } from '../../events/confirmation-answered.ts';
import type { ConfirmationAsked } from '../../events/confirmation-asked.ts';
import type { ConfirmDialogModel } from './confirm-dialog.model.ts';

type Wording = Pick<ConfirmDialogModel, 'title' | 'message' | 'confirmLabel' | 'cancelLabel'>;

export class ConfirmDialogController extends Controller<ConfirmDialogModel, ApplicationDomain> {
  #questions!: Questions;

  protected createModel(): ConfirmDialogModel {
    return { open: false, questionId: null, title: '', message: '', confirmLabel: 'OK', cancelLabel: 'Cancel' };
  }

  protected override onCreate(): void {
    this.#questions = this.domain.questions;
  }

  protected override onInterconnect(): void {
    this.subscribe('ConfirmationAsked', this.#confirmationAsked);
    this.subscribe('ConfirmationAnswered', this.#confirmationAnswered);
    this.handle('accept', this.#accept);
    this.handle('decline', this.#decline);
  }

  #confirmationAsked(question: ConfirmationAsked): void {
    Object.assign(this.model, ConfirmDialogController.#wording(question), { open: true, questionId: question.id });
    this.changed();
  }

  #confirmationAnswered({ id }: ConfirmationAnswered): void {
    if (id !== this.model.questionId) return;
    this.model.open = false;
    this.model.questionId = null;
    this.changed();
  }

  #accept(): void {
    if (this.model.questionId !== null) this.#questions.answer(this.model.questionId, true);
  }

  #decline(): void {
    if (this.model.questionId !== null) this.#questions.answer(this.model.questionId, false);
  }

  static #wording({ reason, subject, count }: ConfirmationAsked): Wording {
    switch (reason) {
      case 'delete-todo':
        return { title: 'Delete this todo?', message: `“${subject}” will be gone for good.`, confirmLabel: 'Delete', cancelLabel: 'Cancel' };
      case 'clear-completed':
        return { title: 'Clear completed todos?', message: `${count} completed ${count === 1 ? 'todo' : 'todos'} will be deleted.`, confirmLabel: 'Clear', cancelLabel: 'Cancel' };
      case 'discard-changes':
        return { title: 'Discard your changes?', message: 'You have changes that are not saved.', confirmLabel: 'Discard', cancelLabel: 'Keep editing' };
    }
  }
}
