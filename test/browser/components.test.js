import { assert, fixture, test } from './harness.js';
import {
  Component, Controller, EventBus, Template,
  attrs, changes, defaultAdapters, establishDomain, html, modal, nothing, useAdapters,
} from '/dist/framework/index.js';

useAdapters(defaultAdapters());
establishDomain({});

/**
 * A component the test drives directly. Its controller's apply() does what an
 * event handler does: write the model, state the change. `renders` records
 * every time its template actually ran.
 * @returns {any}
 */
function widget({ key, view, model = {}, children = () => [], handlers = {} }) {
  const renders = [];
  class TestController extends Controller {
    createModel() { return { ...model }; }
    // Registered the way an application registers them: an unregistered function in an event
    // position is refused when the template is built.
    onInterconnect() { for (const [name, fn] of Object.entries(handlers)) this.handle(name, fn); }
    apply(fields) { Object.assign(this.model, fields); this.changed(); }
  }
  class TestComponent extends Component {
    createTemplate() { return new Template((m, c) => (renders.push(key), view(m, c))); }
    createController() { return new TestController(); }
    createChildren() { return children(); }
  }
  const component = /** @type {any} */ (new TestComponent(key));
  component.renders = renders;
  return component;
}

/** Mount a tree under a stand-in application, the way Application.start() does. */
function mount(root) {
  const host = fixture('<div></div>').firstElementChild;
  changes.clear();
  root.parent = { bus: new EventBus(), parent: null, children: [root] };
  root.create();
  root.interconnect();
  root.activate();
  root.target = host;
  root.render();
  return host;
}

const keysOf = (host, selector) => [...host.querySelectorAll(selector)].map((e) => e.dataset.component);
const textsOf = (host, selector) => [...host.querySelectorAll(selector)].map((e) => e.textContent);

test('a parent renders without disturbing its children: same nodes, typed values kept', () => {
  const child = widget({ key: 'child', view: () => html`<div><input name="t" /></div>` });
  const parent = widget({
    key: 'parent',
    view: (m) => html`<section><h1>${m.title}</h1><div data-component="child"></div></section>`,
    model: { title: 'One' },
    children: () => [child],
  });
  const host = mount(parent);

  const input = host.querySelector('input');
  input.value = 'half-typed';

  parent.controller.apply({ title: 'Two' });
  changes.update();

  assert.equal(host.querySelector('h1').textContent, 'Two');
  assert.ok(host.querySelector('input') === input, 'the child’s input is the very same node');
  assert.equal(input.value, 'half-typed');
});

test('a child renders only when it states a change of its own', () => {
  const child = widget({ key: 'child', view: (m) => html`<b>${m.label}</b>`, model: { label: 'a' } });
  const parent = widget({
    key: 'parent',
    view: (m) => html`<section><i>${m.n}</i><div data-component="child"></div></section>`,
    model: { n: 1 },
    children: () => [child],
  });
  const host = mount(parent);
  assert.deepEqual([parent.renders.length, child.renders.length], [1, 1], 'the first render mounts both');

  parent.controller.apply({ n: 2 });
  changes.update();
  assert.deepEqual([parent.renders.length, child.renders.length], [2, 1], 'the child was never asked');

  child.controller.apply({ label: 'b' });
  changes.update();
  assert.deepEqual([parent.renders.length, child.renders.length], [2, 2], 'and the parent is not asked either');
  assert.equal(host.querySelector('b').textContent, 'b');
});

test('one update renders each stated component once, however many events said so', () => {
  const child = widget({ key: 'child', view: (m) => html`<b>${m.label}</b>`, model: { label: 'a' } });
  const parent = widget({
    key: 'parent',
    view: (m) => html`<section><i>${m.n}</i><div data-component="child"></div></section>`,
    model: { n: 1 },
    children: () => [child],
  });
  mount(parent);

  parent.controller.apply({ n: 2 });
  child.controller.apply({ label: 'b' });
  parent.controller.apply({ n: 3 });
  assert.deepEqual([parent.renders.length, child.renders.length], [1, 1], 'stating a change renders nothing');

  changes.update();
  assert.deepEqual([parent.renders.length, child.renders.length], [2, 2]);
});

test('a placeholder that goes away unmounts its child, and coming back remounts it', () => {
  const child = widget({ key: 'child', view: () => html`<b>here</b>` });
  const parent = widget({
    key: 'parent',
    view: (m) => html`<section>${m.show ? html`<div data-component="child"></div>` : nothing}</section>`,
    model: { show: true },
    children: () => [child],
  });
  const host = mount(parent);
  assert.equal(host.querySelector('b').textContent, 'here');

  parent.controller.apply({ show: false });
  changes.update();
  assert.equal(host.querySelector('b'), null);
  assert.deepEqual([child.target, child.view], [null, null], 'unmounted, and its view goes with it');

  parent.controller.apply({ show: true });
  changes.update();
  assert.equal(host.querySelector('b').textContent, 'here');
  assert.ok(child.target !== null);
});

test('a key inside another component is that component’s business, not ours', () => {
  const grandchild = widget({ key: 'b', view: () => html`<em>grandchild</em>` });
  const first = widget({
    key: 'a',
    view: () => html`<div><div data-component="b"></div></div>`,
    children: () => [grandchild],
  });
  const second = widget({ key: 'b', view: () => html`<strong>sibling</strong>` });
  const parent = widget({
    key: 'parent',
    view: (m) => html`<section><i>${m.n}</i><div data-component="a"></div><div data-component="b"></div></section>`,
    model: { n: 1 },
    children: () => [first, second],
  });
  const host = mount(parent);

  // The parent's own "b" is the sibling placeholder, though the one nested
  // inside "a" comes first in document order.
  const own = host.querySelector('section > [data-component="b"]');
  assert.ok(second.target === own, 'the parent took its own placeholder');
  assert.equal(own.textContent, 'sibling');
  assert.equal(host.querySelector('[data-component="a"] [data-component="b"]').textContent, 'grandchild');

  parent.controller.apply({ n: 2 });
  changes.update();
  assert.equal(host.querySelector('section > [data-component="b"]').textContent, 'sibling', 'still true after a render');
  assert.equal(host.querySelector('[data-component="a"] [data-component="b"]').textContent, 'grandchild');
});

test('reordering keyed placeholders moves the children, it does not rebuild them', () => {
  const rows = ['r1', 'r2', 'r3'].map((key) => widget({ key, view: () => html`<span>${key}</span>` }));
  const parent = widget({
    key: 'parent',
    view: (m) => html`<ul>${m.keys.map((key) => html`<li data-component=${key}></li>`)}</ul>`,
    model: { keys: ['r1', 'r2', 'r3'] },
    children: () => rows,
  });
  const host = mount(parent);
  assert.deepEqual(keysOf(host, 'li'), ['r1', 'r2', 'r3']);

  const firstView = rows[0].view;
  parent.controller.apply({ keys: ['r3', 'r1', 'r2'] });
  changes.update();

  assert.deepEqual(keysOf(host, 'li'), ['r3', 'r1', 'r2']);
  assert.deepEqual(textsOf(host, 'li span'), ['r3', 'r1', 'r2']);
  assert.ok(rows[0].view === firstView, 'r1 kept the very same view element');
  assert.deepEqual(rows.map((r) => r.renders.length), [1, 1, 1], 'no row was re-rendered');
});

test('a child added at runtime renders as soon as its placeholder exists', () => {
  const parent = widget({
    key: 'parent',
    view: (m) => html`<ul>${m.keys.map((key) => html`<li data-component=${key}></li>`)}</ul>`,
    model: { keys: [] },
  });
  const host = mount(parent);
  assert.deepEqual(keysOf(host, 'li'), []);

  const row = widget({ key: 'r1', view: () => html`<span>new row</span>` });
  parent.addChild(row);
  parent.controller.apply({ keys: ['r1'] });
  changes.update();

  assert.equal(host.querySelector('li span').textContent, 'new row');
  assert.ok(row.view !== null && row.target !== null);
});

// ---- Behaviors across renders ----

/** A real click where the user would put it: whatever is at the element's centre gets it. */
function clickAt(element) {
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  hit?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return hit;
}

test('modal: a dialog opened, re-rendered and closed by state leaves no modal and no inert page', () => {
  let outside = 0;
  const dialogs = widget({
    key: 'dialogs',
    view: (m, c) => html`<section>
      <button id="outside" style="position: fixed; left: 0; top: 0; width: 6rem; height: 3rem" @click=${c.handler('outside')}>outside</button>
      <dialog ${modal(m.open)}><p>${m.text}</p><button id="inside">inside</button></dialog>
    </section>`,
    model: { open: false, text: 'first' },
    handlers: { outside: () => { outside++; } },
  });
  const host = mount(dialogs);
  const dialog = host.querySelector('dialog');

  dialogs.controller.apply({ open: true });
  changes.update();
  assert.ok(document.querySelector(':modal') === dialog, 'opened by state');

  dialogs.controller.apply({ text: 'second' }); // the morph strips the open attribute showModal() set
  changes.update();
  assert.ok(dialog.matches(':modal'), 'still modal between renders');
  assert.ok(dialog.checkVisibility(), 'still shown between renders');
  assert.equal(dialog.querySelector('p').textContent, 'second');

  dialogs.controller.apply({ open: false });
  changes.update();
  assert.equal(document.querySelector(':modal'), null, 'no modal left');
  assert.ok(!dialog.contains(document.activeElement), 'focus left the dialog');
  const button = host.querySelector('#outside');
  assert.ok(clickAt(button) === button, 'the outside button is hit, not an inert page');
  assert.equal(outside, 1, 'its handler ran');
});

/** A widget whose one element carries attrs(m.record) beside attributes of its own. */
function recordWidget(record) {
  const view = (m) => html`<div class="own" data-own="kept" ${attrs(m.record)}></div>`;
  const component = widget({ key: 'record', view, model: { record } });
  const host = mount(component);
  return { component, element: host.querySelector('div') };
}


test('attrs: sets each key, true as an empty value, anything else as its string', () => {
  const { element } = recordWidget({ 'data-tone': 'calm', 'data-level': 2, hidden: true, 'aria-current': 'page' });
  assert.equal(element.getAttribute('data-tone'), 'calm');
  assert.equal(element.getAttribute('data-level'), '2');
  assert.equal(element.getAttribute('hidden'), '');
  assert.equal(element.getAttribute('aria-current'), 'page');
});

test('attrs: false, null and undefined remove', () => {
  const { component, element } = recordWidget({ hidden: true, 'data-a': 'x', 'data-b': 'y' });
  component.controller.apply({ record: { hidden: false, 'data-a': null, 'data-b': undefined } });
  changes.update();
  for (const name of ['hidden', 'data-a', 'data-b']) assert.equal(element.hasAttribute(name), false, name);
});

test('attrs: a changed value is rewritten, a dropped key is removed, the template’s own attributes stay', () => {
  const { component, element } = recordWidget({ 'data-tone': 'calm', 'data-level': 1 });
  component.controller.apply({ record: { 'data-tone': 'loud', 'data-level': 1 } });
  changes.update();
  assert.equal(element.getAttribute('data-tone'), 'loud');
  component.controller.apply({ record: { 'data-level': 3 } });
  changes.update();
  assert.equal(element.hasAttribute('data-tone'), false, 'dropped key removed');
  assert.equal(element.getAttribute('data-level'), '3');
  assert.equal(element.getAttribute('class'), 'own');
  assert.equal(element.getAttribute('data-own'), 'kept', 'an attribute the record never named survives');
});

test('attrs: takes an interface with no index signature', () => {
  /** @type {import('/dist/libraries/css/semantics/index.js').CardAttributes} */
  const card = { 'data-card': true, role: null, 'data-card-dense': false, 'data-card-elevation': '2', 'aria-selected': null, 'aria-current': 'true' };
  const { element } = recordWidget(card);
  assert.equal(element.getAttribute('data-card'), '');
  assert.equal(element.getAttribute('data-card-elevation'), '2');
  assert.equal(element.getAttribute('aria-current'), 'true');
  assert.equal(element.hasAttribute('role'), false);
  assert.equal(element.hasAttribute('data-card-dense'), false);
  attrs(card); // checked under tsconfig.checks.json: the parameter is object, so no cast
});
