/** Something that renders itself on demand. Controllers register as this. */
export interface Changeable {
  render(): void;
}

/** A render that keeps registering more work is a loop, not progress. */
const PASSES = 10;

/**
 * Change is stated, never detected.
 *
 * A controller that maps an application event onto its model says so:
 *
 *   #todosListed({ todos }: TodosListed): void {
 *     this.model.rows = todos.map(…);
 *     this.changed();
 *   }
 *
 * and update() renders everything that said so, once each, in the order it
 * was said. Nothing compares, snapshots, or walks the tree looking for work.
 *
 * update() belongs at the end of a DOM event and nowhere else. By then the
 * gesture has been delegated to the application domain, the domain has
 * published its facts, and every controller that cared has mapped them onto
 * its model — so the registrations are complete and the UI is rendered once
 * for the whole gesture.
  * see docs/decisions/a-change-is-stated-never-detected.md
 */
export class ChangeEngine {
  #changed = new Set<Changeable>();
  #updating = false;
  #outstanding = 0;
  #starting = false;
  #checking = false;
  #reported = new Set<string>();

  /**
   * Report a change that nobody drew. Off silences it.
   *
   * `changed()` only registers; something has to call `update()`, and only three things do — a
   * DOM handler registered with `handle()`, the router, and a promise handed back through
   * `own()`. A listener the framework never registered drains nothing, so the model moves, the
   * registration sits in the set, and the screen keeps the old value until an unrelated gesture
   * flushes it. Nothing throws and nothing logs, which makes it the most expensive mistake this
   * framework allows.
   *
   * It is the obvious mistake, too: `@click=${() => c.save()}` is what every other template
   * library teaches, and it type-checks here. The registered form is
   * `@click=${c.handler('save')}`, with `this.handle('save', this.#save)` in `onInterconnect`.
   */
  warnOnUndrawn = true;

  /** State that this instance's model changed and its view is behind. */
  changed(instance: Changeable): void {
    this.#changed.add(instance);
    this.#watch();
  }

  /**
   * Startup is not a gesture: create/interconnect/activate run before the first paint, and
   * `Application.render()` draws the whole tree at the end of them. Anything stated in that
   * window is drawn by that render, so it is not undrawn.
   */
  starting(on: boolean): void {
    this.#starting = on;
  }

  /**
   * Work that will drain the engine when it settles, counted so the check below does not report a
   * change that is simply waiting. `Controller.own()` is the one caller.
   */
  awaiting<T>(work: Promise<T>): Promise<T> {
    this.#outstanding += 1;
    return work.finally(() => {
      this.#outstanding -= 1;
      this.update();
    }) as Promise<T>;
  }

  /**
   * Look again once the current stack has unwound. Every drain is synchronous within the gesture
   * that caused it — a handler, a navigation — so anything still pending by the next macrotask
   * had no gesture behind it. A timer rather than a microtask: a promise chain that resolves
   * already-settled work runs its `finally` in microtasks, and those must get there first.
   */
  #watch(): void {
    if (!this.warnOnUndrawn || this.#checking || this.#updating || this.#starting) return;
    this.#checking = true;
    setTimeout(() => {
      this.#checking = false;
      if (!this.pending || this.#outstanding > 0 || this.#starting) return;
      const names = [...this.#changed].map((c) => c.constructor.name);
      const key = names.join(',');
      if (this.#reported.has(key)) return;
      this.#reported.add(key);
      console.warn(
        `vanilla-mvc: ${names.join(', ')} stated a change that nothing drew.\n` +
          'The change engine draws at the end of a DOM event it delivered, and only a handler ' +
          "registered with this.handle('name', this.#method) is delivered. An inline arrow — " +
          '@click=\${() => c.save()} — runs, writes the model and leaves the screen behind.\n' +
          "Bind it as @click=\${c.handler('save')} instead. If this change really is outside a " +
          'gesture, hand its promise to own(), or set changes.warnOnUndrawn = false.',
      );
    }, 0);
  }

  /** Whether anything is waiting to render. */
  get pending(): boolean {
    return this.#changed.size > 0;
  }

  /**
   * Render everything that said it changed. Call this at the end of a DOM
   * event. Re-entrant calls are absorbed: the drain below picks up anything
   * a render registers.
   */
  update(): void {
    if (this.#updating) return;
    this.#updating = true;
    try {
      for (let pass = 0; this.#changed.size > 0; pass++) {
        if (pass === PASSES) {
          const names = [...this.#changed].map((c) => c.constructor.name).join(', ');
          throw new Error(`Rendering kept registering more changes after ${PASSES} passes: ${names}`);
        }
        const pending = [...this.#changed];
        this.#changed.clear();
        for (const instance of pending) instance.render();
      }
    } finally {
      this.#updating = false;
    }
  }

  /** Forget everything registered. For tests and for teardown. */
  clear(): void {
    this.#changed.clear();
    this.#reported.clear();
  }
}

/** The application's change engine. */
export const changes = new ChangeEngine();
