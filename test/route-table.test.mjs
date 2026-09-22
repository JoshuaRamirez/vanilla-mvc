import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RouteTable } from '../dist/libraries/router/route-table.js';

const table = new RouteTable([
  { name: 'home', path: '/' },
  { name: 'todo', path: '/todos/:id' },
  { name: 'new-todo', path: '/todos/new' },
  { name: 'todos', path: '/todos/:filter?' },
  { name: 'docs', path: '/docs/*' },
  { name: 'old', path: '/old', redirect: '/' },
]);

const name = (url) => table.match(url).name;

test('matches static, param, and optional param routes', () => {
  assert.equal(name('/'), 'home');
  assert.equal(name('/todos'), 'todos');
  assert.deepEqual({ ...table.match('/todos/42').params }, { id: '42' });
});

test('most specific route wins regardless of declaration order', () => {
  assert.equal(name('/todos/new'), 'new-todo');
  assert.equal(name('/todos/7'), 'todo');
});

test('trailing slashes do not matter', () => {
  assert.equal(name('/todos/'), 'todos');
  assert.equal(name('/todos/new/'), 'new-todo');
});

test('wildcards, query, decoding, and full URLs', () => {
  const match = table.match('https://example.com/todos/a%20b?sort=asc&q=x');
  assert.deepEqual({ ...match.params }, { id: 'a b' });
  assert.deepEqual({ ...match.query }, { sort: ['asc'], q: ['x'] });
  assert.equal(match.path, '/todos/a%20b');
  assert.equal(name('/docs/guide/intro'), 'docs');
});

test('unknown URLs fall back', () => {
  const missing = table.match('/nowhere?x=1');
  assert.deepEqual({ ...missing, params: { ...missing.params }, query: { ...missing.query } }, { name: 'not-found', path: '/nowhere', url: '/nowhere?x=1', params: {}, query: { x: ['1'] } });
});

test('redirects are reported on the match', () => {
  assert.equal(table.match('/old').redirect, '/');
});

test('href builds URLs from names, params, and query', () => {
  assert.equal(table.href('home'), '/');
  assert.equal(table.href('todos'), '/todos');
  assert.equal(table.href('todos', { filter: 'active' }), '/todos/active');
  assert.equal(table.href('todo', { id: 'a b/c' }), '/todos/a%20b%2Fc');
  assert.equal(table.href('todos', {}, { q: 'x y', empty: '' }), '/todos?q=x+y');
});

test('a repeated query key matches as a list, in URL order', () => {
  assert.deepEqual({ ...table.match('/todos?to=a&to=b&kind=skill').query }, { to: ['a', 'b'], kind: ['skill'] });
  assert.deepEqual(table.match('/todos?to=b&to=a').query.to, ['b', 'a']);
  assert.equal('sort' in table.match('/todos?to=a').query, false, 'an absent key is absent, never an empty list');
});

test('href writes one pair per value and match gives the list back', () => {
  assert.equal(table.href('todos', {}, { to: ['a', 'b'] }), '/todos?to=a&to=b');
  assert.deepEqual(table.match(table.href('todos', {}, { to: ['a', 'b'] })).query.to, ['a', 'b']);
  assert.equal(table.href('todos', {}, { to: ['a'], kind: 'skill' }), '/todos?to=a&kind=skill');
  assert.equal(table.href('todos', {}, { id: [1, 2] }), '/todos?id=1&id=2');
});

test('an empty list writes no pair, and so does an empty value inside one', () => {
  assert.equal(table.href('todos', {}, { to: [] }), '/todos');
  assert.equal(table.href('todos', {}, { to: [], q: 'x' }), '/todos?q=x');
  assert.equal(table.href('todos', {}, { to: ['a', '', 'b'] }), '/todos?to=a&to=b');
});

test('href refuses unknown names, missing params, and wildcards', () => {
  assert.throws(() => table.href('nope'), /No route named "nope"/);
  assert.throws(() => table.href('todo'), /needs the "id" parameter/);
  assert.throws(() => table.href('docs'), /wildcard/);
});

test('duplicate names are rejected', () => {
  assert.throws(() => new RouteTable([{ name: 'a', path: '/a' }, { name: 'a', path: '/b' }]), /Duplicate route name "a"/);
});

test('base path prefixes matching and building', () => {
  const app = new RouteTable([{ name: 'home', path: '/' }, { name: 'todos', path: '/todos/:filter?' }], { base: '/app/' });
  assert.equal(app.base, '/app');
  assert.equal(app.href('home'), '/app');
  assert.equal(app.href('todos', { filter: 'done' }), '/app/todos/done');
  assert.equal(app.match('/app/').name, 'home');
  assert.equal(app.match('/app/todos').name, 'todos');
  assert.equal(app.match('/todos').name, 'not-found');
  assert.equal(app.owns('/app/todos'), true);
  assert.equal(app.owns('/application'), false);
  assert.equal(app.owns('/api/todos'), false);
});

test('regex constraints pick the right route and are ignored when building', () => {
  const constrained = new RouteTable([
    { name: 'todos', path: '/todos/:filter(active|completed)?' },
    { name: 'todo', path: '/todos/:id(\\d+)' },
  ]);
  assert.equal(constrained.match('/todos').name, 'todos');
  assert.equal(constrained.match('/todos/active').params.filter, 'active');
  assert.equal(constrained.match('/todos/42').name, 'todo');
  assert.equal(constrained.match('/todos/banana').name, 'not-found');
  assert.equal(constrained.href('todo', { id: 42 }), '/todos/42');
  assert.equal(constrained.href('todos', { filter: 'active' }, { q: 'milk' }), '/todos/active?q=milk');
  assert.equal(constrained.match('/todos/active?q=milk').url, '/todos/active?q=milk');
});

test('a query key that names an Object.prototype member is data, not a prototype reach', () => {
  const table = new RouteTable([{ name: 'todos', path: '/todos' }]);
  const match = table.match('/todos?__proto__=a&toString=b&constructor=c&__proto__=d');
  assert.deepEqual(match.query.__proto__, ['a', 'd']);
  assert.deepEqual(match.query.toString, ['b']);
  assert.deepEqual(match.query.constructor, ['c']);
  assert.equal(Object.getPrototypeOf(match.query), null);
  assert.equal(Object.getPrototypeOf(match.params), null);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.getPrototypeOf(table.match('/nowhere?x=1').params), null);
});
