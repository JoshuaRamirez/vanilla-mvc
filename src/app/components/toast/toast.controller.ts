import { Controller } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { Notices } from '../../application/communication/notices.ts';
import type { ServerRequests } from '../../application/server/server-requests.ts';
import type { NoticeRaised } from '../../events/notice-raised.ts';
import type { ToastModel } from './toast.model.ts';

export class ToastController extends Controller<ToastModel, ApplicationDomain> {
  #notices!: Notices;
  #requests!: ServerRequests;

  protected createModel(): ToastModel {
    return { visible: false, tone: 'info', text: '', canRetry: false };
  }

  protected override onCreate(): void {
    this.#notices = this.domain.notices;
    this.#requests = this.domain.requests;
  }

  protected override onInterconnect(): void {
    this.subscribe('NoticeRaised', this.#noticeRaised);
    this.subscribe('NoticeDismissed', this.#noticeDismissed);
    this.handle('retry', this.#retry);
    this.handle('dismiss', this.#dismiss);
  }

  #noticeRaised(notice: NoticeRaised): void {
    this.model.visible = true;
    this.model.tone = notice.reason === 'rejected' || notice.reason === 'request-failed' ? 'error' : 'info';
    this.model.text = ToastController.#wording(notice);
    this.model.canRetry = notice.retryable;
    this.changed();
  }

  #noticeDismissed(): void {
    this.model.visible = false;
    this.changed();
  }

  #retry(): Promise<boolean> {
    this.#notices.dismiss();
    return this.#requests.retry();
  }

  #dismiss(): void {
    this.#notices.dismiss();
  }

  static #wording({ reason, detail }: NoticeRaised): string {
    switch (reason) {
      case 'saved':
        return `Saved “${detail}”.`;
      case 'rejected':
        return detail;
      case 'request-failed':
        return detail || 'Something went wrong talking to the server.';
      case 'failure-armed':
        return 'The next server request will fail.';
    }
  }
}
