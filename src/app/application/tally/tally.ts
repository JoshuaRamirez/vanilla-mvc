import { ApplicationElement } from '../../../framework/index.ts';
import { TallyPublisher } from './tally-publisher.ts';

/** Counting: a count that moves by a step. An empty or invalid step counts as 1. */
export class Tally extends ApplicationElement {
  count = 0;
  step: number | null = 1;
  readonly #publisher = new TallyPublisher((event) => this.publish(event));

  protected override onActivate(): void {
    this.#announce();
  }

  increment(): void {
    this.count += this.#stride;
    this.#announce();
  }

  decrement(): void {
    this.count -= this.#stride;
    this.#announce();
  }

  reset(): void {
    this.count = 0;
    this.#announce();
  }

  changeStep(step: unknown): void {
    this.step = typeof step === 'number' ? step : null;
    this.#announce();
  }

  get #stride(): number {
    return this.step && this.step > 0 ? this.step : 1;
  }

  #announce(): void {
    this.#publisher.changed(this.count, this.step);
  }
}
