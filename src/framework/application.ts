import { useAdapters } from './adapters/adapters.ts';
import { defaultAdapters } from './adapters/defaults.ts';
import { ApplicationElement } from './application-element.ts';
import { establishDomain } from './domain.ts';
import type { Component } from './component.ts';
import { changes } from './change-engine.ts';
import { EventBus } from './event-bus.ts';
import type { IApplication } from './interfaces.ts';
import { Router } from './router.ts';
import { Routes } from './routes.ts';
import type { Adapters, IRouteTable } from './seams.ts';

/**
 * The root. Owns the bus, the application domain, the router, and the shell.
 * The shell is the first component and the root of the component tree.
 *
 *   start() = create() → interconnect() → activate() → render()
 */
export abstract class Application<TDomain extends ApplicationElement = ApplicationElement>
  extends ApplicationElement<Component>
  implements IApplication
{
  bus!: EventBus;
  /** The application domain: what the app knows and does, apart from any screen. */
  domain!: TDomain;
  router!: Router;
  shell!: Component;

  constructor(readonly root: HTMLElement) {
    super();
  }

  protected abstract createDomain(): TDomain;
  protected abstract createShell(): Component;
  /** The library seams. Override to swap a library: return { ...defaultAdapters(), renderer: new MyRenderer() }. */
  protected createAdapters(): Adapters {
    return defaultAdapters();
  }

  protected createRoutes(): IRouteTable {
    return new Routes([]);
  }

  start(): this {
    changes.starting(true);
    try {
      this.create();
      this.interconnect();
      this.activate();
      this.render();
    } finally {
      // render() above drew the whole tree, so every change stated during startup is on screen.
      changes.clear();
      changes.starting(false);
    }
    return this;
  }

  override create(): void {
    useAdapters(this.createAdapters());
    this.bus = new EventBus();
    this.domain = this.createDomain();
    this.domain.parent = this;
    establishDomain(this.domain);
    this.router = new Router(this.createRoutes());
    this.router.parent = this;
    this.shell = this.createShell();
    this.shell.parent = this;
    this.children.push(this.shell);

    this.domain.create();
    this.router.create();
    super.create();
  }

  override interconnect(): void {
    this.domain.interconnect();
    this.router.interconnect();
    super.interconnect();
  }

  override activate(): void {
    this.domain.activate();
    super.activate();
    // Last: announcing the first route needs every subscriber activated.
    this.router.activate();
  }

  render(): void {
    this.shell.target = this.root;
    this.shell.render();
  }

  /** Every component in the tree, depth first. */
  *components(from: Component = this.shell): Generator<Component> {
    yield from;
    for (const child of from.children) yield* this.components(child);
  }
}
