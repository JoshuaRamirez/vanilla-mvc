import { ApplicationElement } from './application-element.ts';
import type { Controller } from './controller.ts';
import type { IComponent } from './interfaces.ts';
import type { Template } from './template.ts';

/**
 * Template + view + controller + model. Subclasses say what to instantiate;
 * create() instantiates it, and every phase cascades to the controller and
 * the child components. The controller creates the model.
 *
 * A child renders into the element in this component's view marked
 * data-component="<child key>". No placeholder, no render.
 */
export abstract class Component<
  TModel extends object = object,
  TController extends Controller<TModel> = Controller<TModel>,
> extends ApplicationElement<Component> implements IComponent {
  template!: Template;
  controller!: TController;
  view: HTMLElement | null = null;
  #target: HTMLElement | null = null;

  constructor(readonly key: string) {
    super();
  }

  protected abstract createTemplate(): Template;
  protected abstract createController(): TController;
  protected createChildren(): Component[] {
    return [];
  }

  /** The model the controller created. */
  get model(): TModel {
    return this.controller.model;
  }

  get target(): HTMLElement | null {
    return this.#target;
  }

  set target(element: HTMLElement | null) {
    this.#target = element;
    if (element) {
      element.component = this;
    } else {
      this.view = null;
      for (const child of this.children) child.target = null;
    }
  }

  override create(): void {
    this.template = this.createTemplate();
    this.controller = this.createController();
    this.controller.parent = this;
    this.controller.component = this;
    for (const child of this.createChildren()) this.#attach(child);

    this.controller.create();
    super.create();
  }

  override interconnect(): void {
    this.controller.interconnect();
    super.interconnect();
  }

  override activate(): void {
    this.controller.activate();
    super.activate();
  }

  /** Render this component and mount every child: the first render of a subtree. */
  render(): void {
    if (!this.target) return;

    this.controller.renderView();
    for (const child of this.children) {
      child.target = this.#placeholder(child.key);
      child.render();
    }
  }

  /**
   * Render this component's own view again, keeping its children's views as
   * they are: each is held aside, the view is rendered with its placeholders
   * empty, and each is put back. A child renders only when it stated a
   * change of its own, or when it has no view yet.
   */
  rerender(): void {
    if (!this.target) return;

    const held = new Map<Component, HTMLElement>();
    for (const child of this.children) {
      if (child.view?.parentElement) {
        held.set(child, child.view);
        child.view.remove();
      }
    }

    this.controller.renderView();

    for (const child of this.children) {
      const previous = child.target;
      child.target = this.#placeholder(child.key);
      if (!child.target) continue; // no placeholder: unmounted, and the view goes with it

      const view = held.get(child);
      // A placeholder that survived rendering keeps its delegated listeners, so
      // the held view can simply go back. A new one has none: render into it.
      if (view && child.target === previous) child.target.appendChild(view);
      else child.render();
    }
  }

  child<T extends Component = Component>(key: string): T | undefined {
    return this.children.find((c) => c.key === key) as T | undefined;
  }

  /**
   * Make the runtime children this call owns match keys: create the missing
   * ones, remove the rest. Children that `owns` rejects are left alone.
   * Returns true when anything was added or removed; the next render mounts them.
   */
  syncChildren(keys: Iterable<string>, create: (key: string) => Component, owns: (child: Component) => boolean = () => true): boolean {
    const wanted = new Set(keys);
    let changed = false;
    for (const child of this.children.filter((c) => owns(c) && !wanted.has(c.key))) {
      this.removeChild(child);
      changed = true;
    }
    for (const key of wanted) {
      if (this.child(key)) continue;
      this.addChild(create(key));
      changed = true;
    }
    return changed;
  }

  /** Add a component at runtime. It goes through all three phases; the next render mounts it. */
  addChild(child: Component): void {
    this.#attach(child);
    child.create();
    child.interconnect();
    child.activate();
  }

  removeChild(child: Component): void {
    const index = this.children.indexOf(child);
    if (index < 0) return;
    this.children.splice(index, 1);
    child.dispose();
    child.target = null;
    child.parent = null;
  }

  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }

  /**
   * The placeholder for key in this component's own view. Another component's
   * placeholder is a boundary: its contents belong to that component, and a
   * key inside it is that component's business, not ours.
   */
  #placeholder(key: string): HTMLElement | null {
    const find = (element: Element): HTMLElement | null => {
      for (const child of element.children) {
        if (!(child instanceof HTMLElement)) continue;
        const owner = child.dataset.component;
        if (owner !== undefined) {
          if (owner === key) return child;
          continue;
        }
        const found = find(child);
        if (found) return found;
      }
      return null;
    };
    return this.view ? find(this.view) : null;
  }

  #attach(child: Component): void {
    if (this.children.some((c) => c.key === child.key)) {
      throw new Error(`"${this.key}" already has a child with key "${child.key}"`);
    }
    child.parent = this;
    this.children.push(child);
  }
}
