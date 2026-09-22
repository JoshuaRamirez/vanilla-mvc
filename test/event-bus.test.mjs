import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../dist/framework/event-bus.js';

test('publishes to subscribers of the event type only', () => {
  const bus = new EventBus();
  const got = [];
  bus.subscribe('Added', (/** @type {any} */ e) => got.push(['added', e.n]));
  bus.subscribe('Removed', () => got.push(['removed']));
  bus.publish({ type: 'Added', n: 1 });
  assert.deepEqual(got, [['added', 1]]);
});

test('events are frozen as they are published', () => {
  const bus = new EventBus();
  const event = { type: 'Added', n: 1 };
  bus.publish(event);
  assert.ok(Object.isFrozen(event));
});

test('unsubscribe stops delivery, including mid-publish', () => {
  const bus = new EventBus();
  const got = [];
  let offSecond;
  bus.subscribe('Added', () => { got.push(1); offSecond(); });
  offSecond = bus.subscribe('Added', () => got.push(2));
  bus.publish({ type: 'Added' });
  bus.publish({ type: 'Added' });
  assert.deepEqual(got, [1, 2, 1]);
});
