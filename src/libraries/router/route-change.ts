import type { RouteMatch } from './route-table.ts';

/**
 * A navigation about to happen, published as router:navigating so guards
 * can cancel it or send it elsewhere. Not published for the first route.
 */
export class RouteChange {
  #cancelled = false;
  #reason: string | undefined;
  #redirectTo: string | undefined;

  constructor(
    readonly from: RouteMatch,
    readonly to: RouteMatch,
    /** False when this navigation can't be stopped. */
    readonly cancelable = true,
  ) {}

  get cancelled(): boolean {
    return this.#cancelled;
  }

  get reason(): string | undefined {
    return this.#reason;
  }

  get redirectTo(): string | undefined {
    return this.#redirectTo;
  }

  get isLeaving(): boolean {
    return this.from.name !== this.to.name;
  }

  leaves(name: string): boolean {
    return this.from.name === name && this.isLeaving;
  }

  enters(name: string): boolean {
    return this.to.name === name && this.isLeaving;
  }

  /** Stay put. Has no effect when the navigation isn't cancelable. */
  cancel(reason?: string): void {
    this.#cancelled = true;
    this.#reason = reason;
  }

  /** Go here instead, replacing the history entry. */
  redirect(path: string): void {
    this.#redirectTo = path;
  }
}
