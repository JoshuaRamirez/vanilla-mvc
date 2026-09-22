import type { ConfirmationReason } from './confirmation-reason.ts';

/** A question for the user. Answer through the domain with the same id. */
export interface ConfirmationAsked {
  readonly type: 'ConfirmationAsked';
  readonly id: number;
  readonly reason: ConfirmationReason;
  readonly subject: string;
  readonly count: number;
}
