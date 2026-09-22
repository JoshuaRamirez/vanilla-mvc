import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChangeEngine } from '../dist/framework/change-engine.js';

/**
 * Something that renders, recording the order into log.
 * @param {string} name
 * @param {string[]} log
 * @param {() => void} [during]
 * @returns {any}
 */
const changeable = (name, log, during) => ({ render: () => (log.push(name), during?.()) });

/**
 * These tests drive the engine directly, with no application and no gesture, so every change they
 * state is undrawn by construction. The guard is for applications; here it would only ever be a
 * false positive.
 * @param {any} engine
 */
const quiet = (engine) => Object.assign(engine, { warnOnUndrawn: false });

test('update renders everything stated, once each, in the order stated', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  const a = changeable('a', log);
  const b = changeable('b', log);

  engine.changed(b);
  engine.changed(a);
  engine.changed(b); // saying it twice is still one render
  engine.update();

  assert.deepEqual(log, ['b', 'a']);
});

test('nothing renders until update; update leaves nothing owed', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  engine.changed(changeable('a', log));

  assert.equal(engine.pending, true);
  assert.deepEqual(log, []); // stating a change does not render

  engine.update();
  assert.deepEqual(log, ['a']);
  assert.equal(engine.pending, false);

  engine.update(); // nothing stated since
  assert.deepEqual(log, ['a']);
});

test('a change stated while rendering is rendered in the next pass', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  const late = changeable('late', log);
  engine.changed(changeable('first', log, () => engine.changed(late)));
  engine.update();

  assert.deepEqual(log, ['first', 'late']);
});

test('update during a render is absorbed, not nested', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  const other = changeable('other', log);
  engine.changed(changeable('first', log, () => {
    engine.changed(other);
    engine.update(); // re-entrant: the pass already running owns the drain
    log.push('returned');
  }));
  engine.update();

  assert.deepEqual(log, ['first', 'returned', 'other']);
});

test('rendering that never settles is reported, not looped forever', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  /** @type {any} */
  const restless = { render: () => (log.push('x'), engine.changed(restless)) };
  engine.changed(restless);

  assert.throws(() => engine.update(), /kept registering more changes after 10 passes/);
  assert.equal(log.length, 10);
});

test('clear forgets what was stated', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  engine.changed(changeable('a', log));
  engine.clear();
  engine.update();

  assert.deepEqual(log, []);
});

test('a throwing render does not wedge the engine', () => {
  const engine = quiet(new ChangeEngine());
  const log = [];
  engine.changed({ render: () => { throw new Error('boom'); } });
  assert.throws(() => engine.update(), /boom/);

  engine.changed(changeable('after', log));
  engine.update();
  assert.deepEqual(log, ['after']);
});

// ---- The undrawn-change guard ----
//
// `changed()` only registers; `update()` draws, and only a registered DOM handler, the router and
// a settled promise call it. A listener the framework never registered drains nothing, so the
// model moves and the screen does not. These tests pin the sentence that says so.

/** Run `body`, collecting console.warn, and give back what it said. */
const warnings = async (body) => {
  const said = [];
  const real = console.warn;
  console.warn = (...args) => said.push(args.join(' '));
  try {
    await body();
    await new Promise((resolve) => setTimeout(resolve, 5)); // the guard looks on the next macrotask
  } finally {
    console.warn = real;
  }
  return said;
};

test('a change nobody drew is reported, naming the instance and the registered form', async () => {
  const engine = new ChangeEngine();
  const said = await warnings(() => engine.changed(changeable('row', [])));
  assert.equal(said.length, 1);
  assert.match(said[0], /stated a change that nothing drew/);
  assert.match(said[0], /handler\('save'\)/, 'it names the form that would have worked');
});

test('a change the gesture drew is not reported', async () => {
  const engine = new ChangeEngine();
  const said = await warnings(() => {
    engine.changed(changeable('row', []));
    engine.update();
  });
  assert.deepEqual(said, []);
});

test('a change waiting on owned work is not reported until that work settles', async () => {
  const engine = new ChangeEngine();
  let release;
  const work = new Promise((resolve) => { release = resolve; });
  const said = await warnings(async () => {
    engine.awaiting(work);
    engine.changed(changeable('row', []));
  });
  assert.deepEqual(said, [], 'outstanding work will drain it; saying so now would be a false alarm');
  release();
  await work.catch(() => {});
});

test('a change stated during startup is not reported: render() draws the whole tree', async () => {
  const engine = new ChangeEngine();
  const said = await warnings(() => {
    engine.starting(true);
    engine.changed(changeable('row', []));
    engine.clear();
    engine.starting(false);
  });
  assert.deepEqual(said, []);
});

test('the same instance is reported once, not on every gesture', async () => {
  const engine = new ChangeEngine();
  const row = changeable('row', []);
  const said = await warnings(async () => {
    engine.changed(row);
    await new Promise((resolve) => setTimeout(resolve, 5));
    engine.changed(row);
  });
  assert.equal(said.length, 1);
});

test('warnOnUndrawn off says nothing', async () => {
  const engine = Object.assign(new ChangeEngine(), { warnOnUndrawn: false });
  assert.deepEqual(await warnings(() => engine.changed(changeable('row', []))), []);
});
