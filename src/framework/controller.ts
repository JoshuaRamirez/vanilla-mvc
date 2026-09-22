import { ApplicationElement } from './application-element.ts';
import { changes } from './change-engine.ts';
import { deliver } from './delivery.ts';
import type { Component } from './component.ts';
import type { NavigationRequested } from './events/navigation-requested.ts';
import type { IController } from './interfaces.ts';
import { establishedDomain } from './domain.ts';
import type { Template } from './template.ts';

/**
 * The component's translator, both ways:
 *
 * - DOM gestures → application domain methods named for what they mean to
 *   the domain. Take the domain objects you need from this.domain into
 *   private fields in onCreate.
 * - Facts on the event bus → model field updates, shaped for the template.
 *
 * Both kinds of handler are private methods. Register them in onInterconnect:
 *
 *   this.subscribe('TodosListed', this.#todosListed); // bus event → #todosListed(event)
 *   this.handle('toggle', this.#toggle);              // template: @change=${c.handler('toggle')}
 *
 * The two kinds end differently, and that difference is the whole rendering
 * model. An event handler that changed the model says so with changed(); it
 * never renders. A DOM handler delegates to the domain and, once the domain
 * is done and every event handler has had its say, asks the change engine to
 * update — one render pass for the whole gesture.
 *
 * The controller also creates the component's model (an interface) at the
 * start of its create phase.
 */
export abstract class Controller<TModel extends object = object, TDomain extends object = object>
  extends ApplicationElement
  implements IController
{
  component!: Component<TModel>;
  /** The component's model: an initialized instance of its interface, created in create(). */
  model!: TModel;
  readonly #domHandlers = new Map<string, (...args: any[]) => void>();

  /** An initialized instance of the component's model interface. */
  protected abstract createModel(): TModel;

  /** The application domain root, established before any component is created. */
  protected get domain(): TDomain {
    return establishedDomain<TDomain>();
  }

  override create(): void {
    this.model = this.createModel();
    super.create();
  }

  get template(): Template {
    return this.component.template;
  }

  get view(): HTMLElement | null {
    return this.component.view;
  }

  /**
   * State that the model changed and the view is behind. Say this at the end
   * of any event handler that wrote to the model. It does not render.
   */
  protected changed(): void {
    changes.changed(this);
  }

  /**
   * Render the view again, keeping the children. The change engine calls
   * this; handlers call changed() instead.
   */
  render(): void {
    this.component.rerender();
  }

  /** Render this component's own template into its target. The component owns the children. */
  renderView(): void {
    const { component } = this;
    if (!component.target) return;
    component.view = this.template.render(this.model, this, component.target);
  }

  /** Register a private method as the DOM event handler a template binds by name. */
  protected handle(name: string, method: (...args: any[]) => unknown): void {
    if (this.#domHandlers.has(name)) throw new Error(`${this.constructor.name} already handles "${name}"`);
    this.#domHandlers.set(name, deliver((...args: any[]) => this.#settle(method.apply(this, args))));
  }

  /** The handler registered under name, for a template: @click=${c.handler('save')}. */
  handler(name: string): (...args: any[]) => void {
    const handler = this.#domHandlers.get(name);
    if (!handler) throw new Error(`${this.constructor.name} has no handler "${name}"; register it with this.handle('${name}', this.#${name})`);
    return handler;
  }

  /** Ask the router to navigate. */
  protected navigate(path: string, replace = false): void {
    this.publish<NavigationRequested>({ type: 'NavigationRequested', path, replace });
  }

  /**
   * Work that outlives the gesture that started it: render again when it
   * settles. A DOM event is one synchronous stack, so everything it causes is
   * rendered when it returns — but a promise leaves that stack, and the facts
   * it publishes land with no gesture to end. Whoever starts such work owns
   * it: a handler by returning it, and anyone else by saying so here.
   *
   *   #toggle(): Promise<boolean> { return this.#todos.toggle(id); }
   *   protected override onActivate(): void { this.own(this.#todos.refresh()); }
   */
  protected own<T>(work: T): T {
    if (work instanceof Promise) changes.awaiting(work);
    return work;
  }

  /**
   * The end of a DOM event: the gesture has been delegated, the domain has
   * published, and every event handler has stated its changes. Render them,
   * and again when any work the handler handed back settles.
   */
  #settle(result: unknown): void {
    changes.update();
    this.own(result);
  }
}
