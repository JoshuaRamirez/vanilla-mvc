import type { NoticeReason } from './notice-reason.ts';

/** Something the user should be told, by reason. detail carries a title or the server's message. */
export interface NoticeRaised {
  readonly type: 'NoticeRaised';
  readonly reason: NoticeReason;
  readonly detail: string;
  readonly retryable: boolean;
}
