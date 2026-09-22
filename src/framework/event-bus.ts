/** An event: plain data whose type names it. Declare each event as an interface with a literal type. */
export interface BusEvent {
  readonly type: string;
}

export type Handler<E extends BusEvent = BusEvent> = (event: E) => void;
export type Unsubscribe = () => void;

/**
 * Synchronous publish/subscribe, keyed by each event's type. The only line
 * between the application domain and its components.
 *
 *   interface TodosListed { readonly type: 'TodosListed'; readonly todos: … }
 *
 *   bus.subscribe('TodosListed', (event: TodosListed) => …);
 *   bus.publish<TodosListed>({ type: 'TodosListed', todos });
 *
 * Events are frozen as they're published.
 */
export class EventBus {
  #handlers = new Map<string, Set<Handler<any>>>();

  /** The event type is taken from the handler; the name must match it. */
  subscribe<E extends BusEvent>(type: NoInfer<E['type']>, handler: Handler<E>): Unsubscribe {
    let handlers = this.#handlers.get(type);
    if (!handlers) this.#handlers.set(type, (handlers = new Set()));
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  publish<E extends BusEvent>(event: E): void {
    Object.freeze(event);
    const handlers = this.#handlers.get(event.type);
    if (!handlers) return;
    // Copy so handlers can subscribe/unsubscribe while we publish.
    for (const handler of [...handlers]) handler(event);
  }
}
