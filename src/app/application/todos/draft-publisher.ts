import type { DraftChanged } from '../../events/draft-changed.ts';
import type { Publish } from '../publish.ts';
import type { WorkAtRisk } from '../work/work-at-risk.ts';

/** Announces the draft, and whether it is work at risk. */
export class DraftPublisher {
  constructor(
    private readonly publish: Publish,
    private readonly workKey: string,
  ) {}

  changed(text: string): void {
    this.publish<DraftChanged>({ type: 'DraftChanged', text });
    this.publish<WorkAtRisk>({ type: 'WorkAtRisk', key: this.workKey, route: 'todos', scope: 'route', atRisk: text.trim() !== '' });
  }
}
