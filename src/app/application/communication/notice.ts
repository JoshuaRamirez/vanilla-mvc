export type NoticeReason = 'saved' | 'rejected' | 'request-failed' | 'failure-armed';

/**
 * Something the user should be told, by reason. Presentation decides the
 * words; detail carries the particulars (a title, the server's message).
 */
export class Notice {
  private constructor(
    readonly reason: NoticeReason,
    readonly detail: string,
    /** The failed request can be run again (answer with requests:retry). */
    readonly retryable: boolean,
  ) {
    Object.freeze(this);
  }

  static saved(title: string): Notice {
    return new Notice('saved', title, false);
  }

  /** The server refused; detail is its reason. */
  static rejected(message: string): Notice {
    return new Notice('rejected', message, false);
  }

  /** The request didn't get a verdict; it can be retried. */
  static requestFailed(message: string): Notice {
    return new Notice('request-failed', message, true);
  }

  static failureArmed(): Notice {
    return new Notice('failure-armed', '', false);
  }

  get isError(): boolean {
    return this.reason === 'rejected' || this.reason === 'request-failed';
  }
}
