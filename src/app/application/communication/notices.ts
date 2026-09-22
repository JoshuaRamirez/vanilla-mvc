import { ApplicationElement } from '../../../framework/index.ts';
import type { Notice } from './notice.ts';
import { NoticePublisher } from './notice-publisher.ts';

const SHOW_MS = 4000;
const SHOW_RETRYABLE_MS = 10000;

/** Telling the user things: one notice at a time, dismissed by the user or after a while. */
export class Notices extends ApplicationElement {
  current: Notice | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #publisher = new NoticePublisher((event) => this.publish(event));

  raise(notice: Notice): void {
    this.current = notice;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.dismiss(), notice.retryable ? SHOW_RETRYABLE_MS : SHOW_MS);
    this.#publisher.raised(notice);
  }

  dismiss(): void {
    clearTimeout(this.#timer);
    if (!this.current) return;
    this.current = null;
    this.#publisher.dismissed();
  }
}
