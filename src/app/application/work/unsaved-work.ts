import { ApplicationElement, NavigationRequested, RouteChanging, type RouteChange } from '../../../framework/index.ts';
import { Confirmation } from '../communication/confirmation.ts';
import type { Questions } from '../communication/questions.ts';
import type { WorkAtRisk } from './work-at-risk.ts';
import type { WorkDiscarded } from './work-discarded.ts';

/**
 * Don't lose the user's work by navigating. Capabilities report work at
 * risk; leaving it asks first, discards on yes, and then goes where the
 * user was going. When a navigation can't be stopped, the work is discarded.
 */
export class UnsavedWork extends ApplicationElement {
  #atRisk = new Map<string, WorkAtRisk>();

  constructor(private readonly questions: Questions) {
    super();
  }

  get keys(): string[] {
    return [...this.#atRisk.keys()];
  }

  protected override onInterconnect(): void {
    this.subscribe<WorkAtRisk>('WorkAtRisk', (work) => this.track(work));
    this.subscribe<RouteChanging>('RouteChanging', ({ change }) => this.guard(change));
  }

  track(work: WorkAtRisk): void {
    if (work.atRisk) this.#atRisk.set(work.key, work);
    else this.#atRisk.delete(work.key);
  }

  /** Work this navigation would lose. */
  endangeredBy(change: RouteChange): WorkAtRisk[] {
    return [...this.#atRisk.values()].filter(
      (work) =>
        change.from.name === work.route &&
        (work.scope === 'url' ? change.to.url !== change.from.url : change.to.name !== change.from.name),
    );
  }

  async guard(change: RouteChange): Promise<void> {
    const endangered = this.endangeredBy(change);
    if (!endangered.length) return;
    if (!change.cancelable) return this.#discard(endangered);

    change.cancel('unsaved work');
    if (!(await this.questions.ask(Confirmation.discardChanges(endangered.length)))) return;
    this.#discard(endangered);
    this.publish<NavigationRequested>({ type: 'NavigationRequested', path: change.to.url, replace: false });
  }

  #discard(work: WorkAtRisk[]): void {
    for (const { key } of work) this.publish<WorkDiscarded>({ type: 'WorkDiscarded', key });
  }
}
