import type { TallyChanged } from '../../events/tally-changed.ts';
import type { Publish } from '../publish.ts';

/** Announces the tally. */
export class TallyPublisher {
  constructor(private readonly publish: Publish) {}

  changed(count: number, step: number | null): void {
    this.publish<TallyChanged>({ type: 'TallyChanged', count, step });
  }
}
