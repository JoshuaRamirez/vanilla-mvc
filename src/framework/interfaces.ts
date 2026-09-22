import type { EventBus } from './event-bus.ts';

/** Anything that lives in a tree. */
export interface IComposite<TParent = unknown, TChild = unknown> {
  parent: TParent | null;
  readonly children: TChild[];
}

/**
 * The one pattern everything follows: create, interconnect, activate.
 * Every method is responsible for calling the same method on its children.
 */
export interface IApplicationElement extends IComposite<IApplicationElement, IApplicationElement> {
  /** Instantiate everything this element owns. */
  create(): void;
  /** Wire up communication (event subscriptions). */
  interconnect(): void;
  /** Initialize. Everything exists and is wired by now. */
  activate(): void;
}

export interface IApplication extends IApplicationElement {
  readonly bus: EventBus;
}

export interface ITemplate {
  /** Render the model into target, bound to the controller. Returns the single root element. */
  render(model: object, controller: object, target: HTMLElement): HTMLElement;
}

/**
 * A component's model: an interface declared in <widget>.model.ts. Fields
 * only, no methods and no logic. The controller creates an initialized
 * instance in its create phase and keeps it current by mapping facts from the
 * event bus, stating each change to the change engine. All state changes go
 * through the application domain.
 */
export type IModel = object;

export interface IController extends IApplicationElement {
  readonly component: IComponent;
  readonly template: ITemplate;
  readonly model: IModel;
  readonly view: HTMLElement | null;
  /** Render the view again, keeping the children. The change engine calls this. */
  render(): void;
  /** Render this component's own template into its target. */
  renderView(): void;
}

export interface IComponent extends IApplicationElement {
  /** Matches the data-component placeholder in the parent's view. */
  readonly key: string;
  readonly template: ITemplate;
  readonly controller: IController;
  readonly model: IModel;
  /** The rendered view. Inserted into target as its only child. */
  view: HTMLElement | null;
  /** The DOM element the view renders into. */
  target: HTMLElement | null;
  readonly children: IComponent[];
  /** Render this component and mount every child: the first render of a subtree. */
  render(): void;
  /** Render this component's own view again, keeping its children's views. */
  rerender(): void;
}

declare global {
  interface Element {
    /** The component whose target this element is. */
    component?: IComponent;
  }
}
