import { ApplicationElement } from '../../../framework/index.ts';
import type { BusyChanged } from '../../events/busy-changed.ts';
import { Notice } from '../communication/notice.ts';
import type { Notices } from '../communication/notices.ts';
import { NotFoundError } from './not-found-error.ts';
import type { TodoApi } from './todo-api.ts';
import { ValidationError } from './validation-error.ts';

/**
 * Every server request runs here: counts what's in flight, tells the user
 * about failures, and keeps the last request that failed without a verdict
 * so it can be run again.
 */
export class ServerRequests extends ApplicationElement {
  /** Requests in flight. */
  pending = 0;
  #retry: (() => Promise<boolean>) | null = null;
  constructor(
    private readonly api: TodoApi,
    private readonly notices: Notices,
  ) {
    super();
  }

  get busy(): boolean {
    return this.pending > 0;
  }

  get canRetry(): boolean {
    return this.#retry !== null;
  }

  /**
   * Run work that talks to the server. Returns true when it completed.
   * Rejections the work doesn't handle become notices; anything else also
   * becomes retryable.
   */
  async run(work: () => Promise<void>): Promise<boolean> {
    this.#track(+1);
    try {
      await work();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        this.notices.raise(Notice.rejected(message));
      } else {
        this.#retry = () => this.run(work);
        this.notices.raise(Notice.requestFailed(message));
      }
      return false;
    } finally {
      this.#track(-1);
    }
  }

  /** Run the last request that failed without a verdict. */
  retry(): Promise<boolean> {
    const retry = this.#retry;
    this.#retry = null;
    return retry ? retry() : Promise.resolve(false);
  }

  /** Make the next request fail, to exercise failure handling. */
  failNext(): void {
    this.api.failNext();
    this.notices.raise(Notice.failureArmed());
  }

  #track(delta: number): void {
    const wasBusy = this.busy;
    this.pending += delta;
    if (this.busy !== wasBusy) this.publish<BusyChanged>({ type: 'BusyChanged', busy: this.busy });
  }
}
