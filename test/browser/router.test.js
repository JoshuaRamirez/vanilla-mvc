import { assert, fixture, test } from './harness.js';
import { HistoryRouter, RouteTable } from '/dist/libraries/router/index.js';
import {
  Application, ApplicationElement, Component, Controller, Routes, Template,
  changes, defaultAdapters, establishDomain, html, nothing, useAdapters,
} from '/dist/framework/index.js';

const BASE = '/test/browser/sandbox';
const HOME = location.pathname + location.search;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await wait(20);
  }
  return fn();
};

/** A router over a sandbox base path. Cleans up and restores the test page URL after. */
async function withRouter(fn, onNavigating) {
  history.replaceState(null, '', `${BASE}/`);
  const changes = [];
  const table = new RouteTable(
    [
      { name: 'home', path: '/' },
      { name: 'item', path: '/items/:id(\\d+)' },
      { name: 'old', path: '/old', redirect: `${BASE}/items/7` },
    ],
    { base: BASE },
  );
  const router = new HistoryRouter({ table, onChanged: (m) => changes.push(m), onNavigating });
  // Keep unintercepted clicks from leaving the test page, but after the router has looked.
  const seen = [];
  const guardPage = (event) => {
    seen.push(event.defaultPrevented);
    event.preventDefault();
  };
  window.addEventListener('click', guardPage);
  try {
    router.start();
    await fn({ router, changes, seen, table });
  } finally {
    router.stop();
    window.removeEventListener('click', guardPage);
    history.replaceState(null, '', HOME);
  }
}

test('start announces the current route', () =>
  withRouter(({ changes }) => {
    assert.deepEqual(changes.map((c) => c.name), ['home']);
  }));

test('navigate pushes history and announces the match', () =>
  withRouter(({ router, changes }) => {
    const length = history.length;
    assert.equal(router.navigate(`${BASE}/items/42?tab=notes`), true);
    assert.equal(location.pathname, `${BASE}/items/42`);
    assert.equal(history.length, length + 1);
    const last = changes.at(-1);
    assert.deepEqual([last.name, last.params.id, last.query.tab], ['item', '42', ['notes']]);
  }));

test('a link href() built with a repeated key survives the click and reads back as a list', () =>
  withRouter(({ changes, table }) => {
    const href = table.href('item', { id: 5 }, { to: ['a', 'b'], kind: 'skill', none: [] });
    assert.equal(href, `${BASE}/items/5?to=a&to=b&kind=skill`);
    fixture(`<a href="${href}">go</a>`).querySelector('a').click();
    assert.equal(location.search, '?to=a&to=b&kind=skill');
    const last = changes.at(-1);
    assert.deepEqual(last.query.to, ['a', 'b']);
    assert.deepEqual(last.query.kind, ['skill']);
    assert.equal('none' in last.query, false, 'an empty list wrote no pair');
  }));

test('replace does not add a history entry', () =>
  withRouter(({ router }) => {
    const length = history.length;
    router.navigate(`${BASE}/items/1`, { replace: true });
    assert.equal(history.length, length);
    assert.equal(location.pathname, `${BASE}/items/1`);
  }));

test('same-origin link clicks inside the base are intercepted', () =>
  withRouter(({ changes, seen }) => {
    const link = fixture(`<a href="${BASE}/items/5"><span>go</span></a>`).querySelector('span');
    link.click();
    assert.equal(location.pathname, `${BASE}/items/5`);
    assert.equal(changes.at(-1).name, 'item');
    assert.deepEqual(seen, [true]);
  }));

test('links outside the base, external, targeted, downloads, modified clicks, and anchors are left alone', () =>
  withRouter(({ changes, seen }) => {
    const host = fixture(`
      <a id="outside" href="/elsewhere">x</a>
      <a id="external" href="${BASE}/items/1" data-external>x</a>
      <a id="blank" href="${BASE}/items/1" target="_blank">x</a>
      <a id="download" href="${BASE}/items/1" download>x</a>
      <a id="anchor" href="#section">x</a>
      <a id="plain" href="${BASE}/items/1">x</a>`);
    for (const id of ['outside', 'external', 'blank', 'download', 'anchor']) /** @type {HTMLElement} */ (host.querySelector(`#${id}`)).click();
    host.querySelector('#plain').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    assert.deepEqual(seen, [false, false, false, false, false, false]);
    assert.equal(changes.length, 1);
  }));

test('guards can cancel a navigation', () =>
  withRouter(
    ({ router, changes }) => {
      assert.equal(router.navigate(`${BASE}/items/9`), false);
      assert.equal(location.pathname, `${BASE}/`);
      assert.equal(changes.length, 1);
    },
    (change) => change.to.params.id === '9' && change.cancel('nope'),
  ));

test('guards can redirect, replacing the entry', () =>
  withRouter(
    ({ router, changes }) => {
      router.navigate(`${BASE}/items/3`);
      assert.equal(location.pathname, `${BASE}/items/4`);
      assert.deepEqual(changes.map((c) => c.params.id ?? 'home'), ['home', '4']);
    },
    (change) => change.to.params.id === '3' && change.redirect(`${BASE}/items/4`),
  ));

test('route redirects are followed', () =>
  withRouter(({ router, changes }) => {
    router.navigate(`${BASE}/old`);
    assert.equal(location.pathname, `${BASE}/items/7`);
    assert.equal(changes.at(-1).params.id, '7');
  }));

test('back and forward announce the route', () =>
  withRouter(async ({ router, changes }) => {
    router.navigate(`${BASE}/items/1`);
    router.navigate(`${BASE}/items/2`);
    history.back();
    assert.ok(await until(() => changes.at(-1).params.id === '1'), 'back');
    assert.equal(location.pathname, `${BASE}/items/1`);
    history.forward();
    assert.ok(await until(() => changes.at(-1).params.id === '2'), 'forward');
  }));

test('a guard can cancel back; the URL is put back', () => {
  let block = false;
  return withRouter(
    async ({ router, changes }) => {
      router.navigate(`${BASE}/items/1`);
      router.navigate(`${BASE}/items/2`);
      block = true;
      const count = changes.length;
      history.back();
      await wait(300);
      assert.ok(await until(() => location.pathname === `${BASE}/items/2`), `url restored, was ${location.pathname}`);
      assert.equal(changes.length, count, 'no route change announced');
      block = false;
      history.back();
      assert.ok(await until(() => changes.at(-1).params.id === '1'), 'back works once unblocked');
    },
    (change) => block && change.cancel('blocked'),
  );
});

test('first-route focus is left alone; a new page gets focus', () =>
  withRouter(({ router }) => {
    const main = fixture('<main><h1>Title</h1></main>').querySelector('h1');
    router.navigate(`${BASE}/items/1`);
    assert.equal(document.activeElement, main);
    assert.equal(main.getAttribute('tabindex'), '-1');
  }));

// ---- Through the framework's Router: a navigation is a DOM event it ends ----

/**
 * A one-component application over the sandbox base. Its controller reads
 * RouteChanging: while `dirty`, it cancels and asks, the way a leave guard
 * does. The navigator is kept so the test can stop it.
 */
async function withApplication(fn) {
  history.replaceState(null, '', `${BASE}/`);
  /** @type {import('/dist/framework/index.js').INavigator | null} */
  let navigator = null;
  const renders = [];
  /** @extends {Controller<{ route: string, dirty: boolean, asking: boolean, alsoRedirect: boolean }>} */
  class ShellController extends Controller {
    createModel() { return { route: '', dirty: true, asking: false, alsoRedirect: false }; }
    onInterconnect() {
      this.subscribe('RouteChanging', (/** @type {import('/dist/framework/index.js').RouteChanging} */ { change }) => {
        if (!this.model.dirty) return;
        change.cancel('unsaved');
        if (this.model.alsoRedirect) change.redirect(`${BASE}/items/6`);
        this.model.asking = true;
        this.changed();
      });
      this.subscribe('RouteChanged', (/** @type {import('/dist/framework/index.js').RouteChanged} */ { route }) => {
        this.model.route = route.name;
        this.changed();
      });
    }
    settle() { this.model.dirty = false; }
    redirectToo() { this.model.alsoRedirect = true; }
  }
  class Shell extends Component {
    createTemplate() {
      return new Template((m) => (renders.push(m.route), html`<section>
        <b id="route">${m.route}</b>
        ${m.asking ? html`<p id="question">Leave without saving?</p>` : nothing}
        <a id="go" href="${BASE}/items/5">go</a>
      </section>`));
    }
    createController() { return new ShellController(); }
  }
  class TestApplication extends Application {
    createDomain() { return new (class extends ApplicationElement {})(); }
    createShell() { return new Shell('shell'); }
    createRoutes() { return new Routes([{ name: 'home', path: '/' }, { name: 'item', path: '/items/:id(\\d+)' }], { base: BASE }); }
    createAdapters() {
      const adapters = defaultAdapters();
      const { routing } = adapters;
      return {
        ...adapters,
        routing: { createTable: (routes, options) => routing.createTable(routes, options), createNavigator: (o) => (navigator = routing.createNavigator(o)) },
      };
    }
  }
  const guardPage = (event) => event.preventDefault();
  window.addEventListener('click', guardPage);
  const root = /** @type {HTMLElement} */ (fixture('<div></div>').firstElementChild);
  changes.clear();
  const app = /** @type {any} */ (new TestApplication(root));
  try {
    app.start();
    await fn({ app, root, renders, shell: app.shell });
  } finally {
    navigator?.stop();
    window.removeEventListener('click', guardPage);
    history.replaceState(null, '', HOME);
    changes.clear();
    useAdapters(defaultAdapters());
    establishDomain({});
  }
}

test('Router: a link click a guard cancels draws the question at once, and stays put', () =>
  withApplication(({ root, renders }) => {
    assert.equal(root.querySelector('#question'), null, 'no question before');
    const count = renders.length;
    /** @type {HTMLElement} */ (root.querySelector('#go')).click();
    assert.ok(root.querySelector('#question') !== null, 'the question is drawn with no further gesture');
    assert.equal(location.pathname, `${BASE}/`, 'the location is unchanged');
    assert.equal(root.querySelector('#route').textContent, 'home');
    assert.equal(renders.length, count + 1, 'one render for the cancelled navigation');
  }));

test('Router: a link click nobody cancels updates exactly as before', () =>
  withApplication(({ root, renders, shell }) => {
    shell.controller.settle();
    const count = renders.length;
    /** @type {HTMLElement} */ (root.querySelector('#go')).click();
    assert.equal(location.pathname, `${BASE}/items/5`);
    assert.equal(root.querySelector('#route').textContent, 'item');
    assert.equal(root.querySelector('#question'), null);
    assert.equal(renders.length, count + 1, 'one render for the navigation');
  }));

test('Router: a guard that cancels and also redirects is cancelled, and still draws', () =>
  withApplication(({ root, shell }) => {
    shell.controller.redirectToo();
    /** @type {HTMLElement} */ (root.querySelector('#go')).click();
    assert.equal(location.pathname, `${BASE}/`, 'cancel wins over redirect in the navigator');
    assert.ok(root.querySelector('#question') !== null, 'the question is drawn');
  }));
