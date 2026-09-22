import type { NoticeDismissed } from '../../events/notice-dismissed.ts';
import type { NoticeRaised } from '../../events/notice-raised.ts';
import type { Publish } from '../publish.ts';
import type { Notice } from './notice.ts';

/** Announces notices as events. */
export class NoticePublisher {
  constructor(private readonly publish: Publish) {}

  raised({ reason, detail, retryable }: Notice): void {
    this.publish<NoticeRaised>({ type: 'NoticeRaised', reason, detail, retryable });
  }

  dismissed(): void {
    this.publish<NoticeDismissed>({ type: 'NoticeDismissed' });
  }
}
