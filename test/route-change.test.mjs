import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RouteChange } from '../dist/libraries/router/route-change.js';

/** @returns {import('../dist/libraries/router/route-table.js').RouteMatch} */
const at = (name) => ({ name, path: `/${name}`, url: `/${name}`, params: {}, query: {} });

test('starts uncancelled with no redirect', () => {
  const change = new RouteChange(at('home'), at('todos'));
  assert.equal(change.cancelled, false);
  assert.equal(change.redirectTo, undefined);
});

test('cancel and redirect are recorded', () => {
  const change = new RouteChange(at('home'), at('admin'));
  change.cancel('nope');
  change.redirect('/login');
  assert.equal(change.cancelled, true);
  assert.equal(change.reason, 'nope');
  assert.equal(change.redirectTo, '/login');
});

test('leaving and entering compare route names', () => {
  const change = new RouteChange(at('todos'), at('home'));
  assert.equal(change.leaves('todos'), true);
  assert.equal(change.enters('home'), true);
  assert.equal(change.leaves('home'), false);
  const sameRoute = new RouteChange(at('todos'), { ...at('todos'), params: { filter: 'active' } });
  assert.equal(sameRoute.isLeaving, false);
  assert.equal(sameRoute.leaves('todos'), false);
});

test('cancelable defaults to true and is carried', () => {
  assert.equal(new RouteChange(at('a'), at('b')).cancelable, true);
  assert.equal(new RouteChange(at('a'), at('b'), false).cancelable, false);
});
