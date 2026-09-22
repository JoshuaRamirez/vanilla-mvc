import type { BusEvent, Handler, Unsubscribe } from './event-bus.ts';
import type { IApplication, IApplicationElement } from './interfaces.ts';

/**
 * Base for everything that follows create → interconnect → activate.
 * Each phase runs this element's own step, then the same phase on every child.
 * Subclasses override onCreate, onInterconnect, and onActivate; the public methods own the recursion.
 */
export abstract class ApplicationElement<TChild extends IApplicationElement = IApplicationElement>
  implements IApplicationElement
{
  parent: IApplicationElement | null = null;
  readonly children: TChild[] = [];
  #subscriptions: Unsubscribe[] = [];

  create(): void {
    this.onCreate();
    for (const child of this.children) child.create();
  }

  interconnect(): void {
    this.onInterconnect();
    for (const child of this.children) child.interconnect();
  }

  activate(): void {
    this.onActivate();
    for (const child of this.children) child.activate();
  }

  /**
   * Take `capability` on as a child: set its parent, and put it in the tree so it goes through
   * create, interconnect and activate with this element.
   *
   * Both halves, always. Pushing to `children` alone looks right and runs fine until the child
   * publishes, because `application` walks `parent` to find the bus — so the failure arrives
   * later, somewhere else, as "X is not attached to an application".
   *
   *   protected override onCreate(): void {
   *     this.counter = this.adopt(new Counter());
   *   }
   */
  protected adopt<T extends TChild>(capability: T): T {
    capability.parent = this;
    this.children.push(capability);
    return capability;
  }

  /** Tear down subscriptions. Only needed for elements removed at runtime. */
  dispose(): void {
    for (const child of this.children) (child as unknown as ApplicationElement).dispose?.();
    for (const unsubscribe of this.#subscriptions) unsubscribe();
    this.#subscriptions = [];
  }

  protected onCreate(): void {}
  protected onInterconnect(): void {}
  protected onActivate(): void {}

  /** The application at the root of the tree. */
  get application(): IApplication {
    let node: IApplicationElement | null = this;
    while (node && !('bus' in node)) node = node.parent;
    if (!node) throw new Error(`${this.constructor.name} is not attached to an application`);
    return node as IApplication;
  }

  /** Publish an event: publish<TodosListed>({ type: 'TodosListed', … }). */
  protected publish<E extends BusEvent>(event: E): void {
    this.application.bus.publish(event);
  }

  /** Subscribe to an event type: subscribe('TodosListed', this.#todosListed). */
  protected subscribe<E extends BusEvent>(type: NoInfer<E['type']>, handler: Handler<E>): void {
    this.#subscriptions.push(this.application.bus.subscribe<E>(type, handler.bind(this)));
  }
}
