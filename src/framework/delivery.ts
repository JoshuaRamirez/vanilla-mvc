/**
 * Which functions the change engine will hear from.
 *
 * The engine draws at the end of a DOM event it delivered, and it delivers only what a
 * controller registered with `handle()`. A function bound in an event position that was not
 * registered runs, writes the model, calls `changed()` — and the screen stays where it was.
 *
 * So a registered handler carries a mark, and so does anything the view helpers build from marked
 * handlers (`prevent`, `field`, `formValues`, `keys`). The renderer adapter checks every event
 * position when a template is built and refuses an unmarked function there, at the first render,
 * with the fix in the message — rather than a click that does nothing, later, silently.
 *
 * `Symbol.for`, not `Symbol`: two copies of the framework in one page (a linked package and an
 * installed one) must still recognise each other's handlers.
 */
const DELIVERED = Symbol.for('vanilla-mvc.delivered');

type Marked = { [DELIVERED]?: true };

/** Mark `fn` as a function the change engine will hear from. Returns it. */
export function deliver<F extends (...args: any[]) => unknown>(fn: F): F {
  (fn as Marked)[DELIVERED] = true;
  return fn;
}

/** Whether `value` is a function the change engine will hear from. */
export function isDelivered(value: unknown): boolean {
  return typeof value === 'function' && (value as Marked)[DELIVERED] === true;
}

/** Mark `wrapper` when every function it wraps is marked: a helper passes the mark through. */
export function deliverIf<F extends (...args: any[]) => unknown>(wrapper: F, ...inner: unknown[]): F {
  return inner.every(isDelivered) ? deliver(wrapper) : wrapper;
}
