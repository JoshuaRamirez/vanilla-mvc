import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../dist/framework/event-bus.js';
import { Component } from '../dist/framework/component.js';
import { Controller } from '../dist/framework/controller.js';
import { establishDomain } from '../dist/framework/domain.js';

/**
 * A stand-in application: a real bus.
 * @returns {any}
 */
function application() {
  return { bus: new EventBus(), parent: null, children: [] };
}

// ---- Framework: runtime children ----

establishDomain({});


/** @typedef {{ pings: number }} RowModel */

/** @extends {Controller<RowModel>} */
class RowController extends Controller {
  /** @returns {RowModel} */
  createModel() { return { pings: 0 }; }
  onInterconnect() { this.subscribe('Ping', () => { this.model.pings += 1; }); }
}

/** A template that renders nothing. @type {any} */
const blank = { render() {} };

/** @extends {Component<RowModel, RowController>} */
class Row extends Component {
  createTemplate() { return blank; }
  createController() { return new RowController(); }
}

/** @extends {Component<RowModel, RowController>} */
class List extends Component {
  createTemplate() { return blank; }
  createController() { return new RowController(); }
  /** @returns {any[]} */
  createChildren() { return [new Row('header')]; }
}

/** A row child by key. */
const rowAt = (list, key) => /** @type {Row} */ (list.child(key));

test('syncChildren adds, keeps, and removes runtime children, running the lifecycle', () => {
  const app = application();
  const list = new List('list');
  list.parent = app;
  list.create(); list.interconnect(); list.activate();
  const isRow = (c) => c.key.startsWith('row-');

  assert.equal(list.syncChildren(['row-1', 'row-2'], (key) => new Row(key), isRow), true);
  const kept = list.child('row-1');
  assert.deepEqual(list.children.map((c) => c.key), ['header', 'row-1', 'row-2']);

  assert.equal(list.syncChildren(['row-1', 'row-2'], (key) => new Row(key), isRow), false);
  list.syncChildren(['row-1', 'row-3'], (key) => new Row(key), isRow);
  assert.deepEqual(list.children.map((c) => c.key), ['header', 'row-1', 'row-3']);
  assert.equal(list.child('row-1'), kept);

  app.bus.publish({ type: 'Ping' });
  assert.equal(rowAt(list, 'row-3').model.pings, 1, 'new child was interconnected');
  assert.equal(rowAt(list, 'header').model.pings, 1);
});

test('removed children stop hearing the bus', () => {
  const app = application();
  const list = new List('list');
  list.parent = app;
  list.create(); list.interconnect(); list.activate();
  list.syncChildren(['row-1'], (key) => new Row(key), (c) => c.key.startsWith('row-'));
  const removed = rowAt(list, 'row-1');
  list.syncChildren([], (key) => new Row(key), (c) => c.key.startsWith('row-'));
  app.bus.publish({ type: 'Ping' });
  assert.equal(removed.model.pings, 0);
  assert.equal(removed.parent, null);
});

test('the controller creates the model in its create phase; the component exposes it', () => {
  const app = application();
  const row = new Row('row');
  row.parent = app;
  assert.throws(() => row.model);
  row.create();
  assert.deepEqual(row.model, { pings: 0 });
  assert.equal(row.model, row.controller.model);
});

test('controllers reach the established domain root', () => {
  const domain = { name: 'root' };
  establishDomain(domain);
  class Probe extends Controller { createModel() { return {}; } get root() { return this.domain; } }
  assert.equal(new Probe().root, domain);
  establishDomain({});

});
