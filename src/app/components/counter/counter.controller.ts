import { Controller, type FieldChange } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { Tally } from '../../application/tally/tally.ts';
import type { TallyChanged } from '../../events/tally-changed.ts';
import type { CounterModel } from './counter.model.ts';

export class CounterController extends Controller<CounterModel, ApplicationDomain> {
  #tally!: Tally;

  protected createModel(): CounterModel {
    return { count: 0, step: '1', canReset: false };
  }

  protected override onCreate(): void {
    this.#tally = this.domain.tally;
  }

  protected override onInterconnect(): void {
    this.subscribe('TallyChanged', this.#tallyChanged);
    this.handle('increment', this.#increment);
    this.handle('decrement', this.#decrement);
    this.handle('reset', this.#reset);
    this.handle('stepChanged', this.#stepChanged);
  }

  #tallyChanged({ count, step }: TallyChanged): void {
    this.model.count = count;
    this.model.step = step === null ? '' : String(step);
    this.model.canReset = count !== 0;
    this.changed();
  }

  #increment(): void {
    this.#tally.increment();
  }

  #decrement(): void {
    this.#tally.decrement();
  }

  #reset(): void {
    this.#tally.reset();
  }

  #stepChanged({ value }: FieldChange): void {
    this.#tally.changeStep(value);
  }
}
