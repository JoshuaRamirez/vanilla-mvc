/** A question was answered. */
export interface ConfirmationAnswered {
  readonly type: 'ConfirmationAnswered';
  readonly id: number;
  readonly confirmed: boolean;
}
