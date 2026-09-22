import { changes } from '../dist/framework/change-engine.js';
import { EventBus } from '../dist/framework/event-bus.js';
import { establishDomain } from '../dist/framework/domain.js';

/**
 * A stand-in application: a real bus that records everything published as { name, event }.
 * @returns {any}
 */
export function application() {
  const bus = new EventBus();
  const sent = [];
  const publish = bus.publish.bind(bus);
  bus.publish = (event) => {
    sent.push({ name: event.type, event });
    publish(event);
  };
  return { bus, sent, parent: null, children: [] };
}

/**
 * Attach a domain element to a stand-in application and wire its subscriptions.
 * @param {any} element
 */
export function attached(element) {
  const app = application();
  element.parent = app;
  element.interconnect();
  return { element, ...app };
}

/** Names of everything published, in order. */
export const namesOf = (sent) => sent.map(({ name }) => name);

/** The last event published under a name. */
export const last = (sent, name) => sent.filter((s) => s.name === name).at(-1)?.event;

/**
 * Records every method called on it: calls → [['collection.rename', 2, 'x'], …].
 * @param {string} name
 * @param {any[]} calls
 * @param {Record<string, unknown>} [returns]
 * @returns {any}
 */
export function recorder(name, calls, returns = {}) {
  return new Proxy({}, { get: (_, method) => (...args) => (calls.push([`${name}.${String(method)}`, ...args]), returns[String(method)]) });
}

/**
 * Mount a controller the way a component would, over a stand-in domain.
 * Returns its model, the bus, what it published, and every render it was
 * asked for, so a test can check that a gesture renders once and no more.
 * @param {any} ControllerClass
 * @param {object} domain
 * @param {...any} args
 * @returns {any}
 */
export function mount(ControllerClass, domain, ...args) {
  establishDomain(domain);
  changes.clear(); // nothing another test stated is owed a render here
  const app = application();
  const synced = [];
  const renders = [];
  const component = {
    target: null,
    view: null,
    children: [],
    parent: app,
    render: () => renders.push('render'),
    rerender: () => renders.push('rerender'),
    syncRows: (listed) => (synced.push(listed), true),
  };
  const controller = new ControllerClass(...args);
  controller.component = component;
  controller.parent = component;
  controller.create();
  controller.interconnect();
  controller.activate();
  return { controller, model: controller.model, synced, renders, ...app };
}

export const route = (name, params = {}, query = {}) => {
  const search = new URLSearchParams(query).toString();
  const path = `/${name}${params.id ? `/${params.id}` : ''}`;
  return { name, path, url: path + (search ? `?${search}` : ''), params, query };
};
