// The testing library's own test: serve the repo on 4600 as a
// child through serve(), drive test/browser/index.html headlessly and read
// window.results. It tests the driver, not the page: the page's verdict is
// test/browser-page.test.mjs. Skips loudly when there is no Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromePath, launch, serve } from '../testing/index.mjs';

/** A PNG's first eight bytes, by the format's own definition. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const PORT = 4600;
const PAGE = `http://127.0.0.1:${PORT}/test/browser/index.html`; // the file name matters: /test/browser/ is the SPA fallback
const FILE_BUDGET = 60_000;
const PAGE_BUDGET = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // always awaited, never raced

const chrome = chromePath();
const hasChrome = await access(chrome).then(() => true, () => false);

test(
  'browser-testing: the driver serves the repo and runs the browser page',
  { timeout: FILE_BUDGET, skip: hasChrome ? false : `no Chrome at ${chrome}; set CHROME to a binary` },
  async (t) => {
    const started = performance.now();
    const server = await serve({ args: ['server.mjs'], env: { PORT: String(PORT) }, port: PORT });
    let browser;
    let page;
    try {
      assert.equal(server.url, `http://127.0.0.1:${PORT}`);
      browser = await launch({ chrome });
      page = await browser.newPage();

      await t.test('the driver reads window.results once the page has run', async () => {
        await page.goto(PAGE);
        assert.equal(await page.evaluate('document.title'), 'VanillaMVC browser tests');
        const deadline = Date.now() + PAGE_BUDGET;
        while ((await page.text('#summary')) === 'Running…') {
          assert.ok(Date.now() < deadline, `#summary still "Running…" after ${PAGE_BUDGET} ms; page errors: ${JSON.stringify(page.errors())}`);
          await sleep(100);
        }
        // The harness's contract (test/browser/harness.js is browser-testing's):
        // four counts and no total, and once #summary has changed window.results is the
        // finished object — never the page's <ul id="results"> the window exposes by name.
        const results = await page.evaluate('window.results');
        assert.deepEqual(Object.keys(results).sort(), ['failed', 'failures', 'passed', 'skipped'], `window.results is not the harness's object: ${JSON.stringify(results)}`);
        assert.equal(typeof results.passed, 'number');
        assert.equal(typeof results.failed, 'number');
        assert.ok(
          Array.isArray(results.failures) && results.failures.every((failure) => typeof failure.name === 'string' && typeof failure.error === 'string'),
          `failures are not [{ name, error }]: ${JSON.stringify(results.failures)}`,
        );
        assert.ok(
          Array.isArray(results.skipped) && results.skipped.every((file) => typeof file === 'string'),
          `skipped is not a list of file names: ${JSON.stringify(results.skipped)}`,
        );
        assert.ok(results.passed + results.failed > 0, `the page ran no tests at all: ${JSON.stringify(results)}`);
      });

      await t.test('waitFor rejects naming the selector and the timeout', async () => {
        await assert.rejects(page.waitFor('#never', { timeout: 200 }), { name: 'Error', message: /"#never"[^]*\b200\b/ });
      });

      await t.test('errors() collects uncaught page exceptions', async () => {
        await page.evaluate('setTimeout(() => { throw new Error("boom") })');
        await sleep(100);
        const uncaught = page.errors().filter((error) => error.source === 'exception' && /boom/.test(error.message));
        assert.ok(uncaught.length > 0, `no exception naming boom among ${JSON.stringify(page.errors())}`);
      });

      await t.test('value() reads a form control on the demo; viewport() resizes the page', async () => {
        await page.goto(`${server.url}/todos`);
        await page.waitFor('#todo-draft');
        assert.equal(await page.value('#todo-draft'), '');
        await page.type('#todo-draft', 'Walk the dog');
        assert.equal(await page.value('#todo-draft'), 'Walk the dog');
        await assert.rejects(page.value('#nope'), { message: 'no element matches "#nope"' });

        await page.viewport({ width: 500, height: 400 });
        assert.deepEqual(await page.evaluate('[innerWidth, innerHeight]'), [500, 400]);
        await page.viewport({ width: 1024, height: 768 });
        assert.deepEqual(await page.evaluate('[innerWidth, innerHeight]'), [1024, 768]);
        await assert.rejects(page.viewport({ width: 0, height: 400 }), { message: /viewport: bad size/ });
      });

      await t.test('attribute() reads the DOM attribute, not the property, and null when there is none', async () => {
        await page.goto(`${server.url}/todos`); // a fresh page: the draft is empty and its value attribute was never written
        await page.waitFor('#todo-draft');
        assert.equal(await page.attribute('#todo-draft', 'placeholder'), 'What needs doing?');
        assert.equal(await page.attribute('#todo-draft', 'autocomplete'), 'off');
        assert.equal(await page.attribute('#todo-draft', 'value'), null, 'the template writes .value as a property; the attribute was never set');
        await page.type('#todo-draft', 'Walk the dog');
        assert.equal(await page.value('#todo-draft'), 'Walk the dog', 'the property moved');
        assert.equal(await page.attribute('#todo-draft', 'value'), null, 'and the attribute did not');

        // A boolean attribute and a missing one, on a probe outside the app's root so no
        // render can take it away. Nothing in the demo carries a boolean attribute that does
        // not depend on a request having finished.
        await page.evaluate(`document.body.insertAdjacentHTML('beforeend', '<input id="probe" disabled data-probe="1">')`);
        assert.equal(await page.attribute('#probe', 'disabled'), '', 'a boolean attribute that is present reads as the empty string');
        assert.equal(await page.attribute('#probe', 'data-probe'), '1');
        assert.equal(await page.attribute('#probe', 'data-missing'), null, 'an attribute the element does not carry reads as null');
        await page.evaluate(`document.getElementById('probe').remove()`);

        await assert.rejects(page.attribute('#nope', 'id'), { message: 'no element matches "#nope"' });
      });

      await t.test('screenshot() writes a non-empty PNG where it was asked, and says so when it cannot', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'browser-testing-'));
        const file = join(directory, 'shot.png');
        try {
          await page.screenshot(file);
          const png = await readFile(file);
          assert.ok(png.byteLength > 0, 'the file is empty');
          assert.deepEqual([...png.subarray(0, 8)], PNG_SIGNATURE, `not a PNG: ${png.subarray(0, 8).toString('hex')}`);
          await assert.rejects(page.screenshot(join(directory, 'no-such-directory', 'shot.png')), { code: 'ENOENT' });
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });

      await t.test('the harness shadows a page <ul id="results"> from the moment it loads', async () => {
        // The window exposes an element by its id, so before harness.js loads, window.results
        // is the <ul> the page renders into — a driver reading it early gets an element with no
        // counts. Proved here on a page that has no harness, then given one.
        const seen = await page.evaluate(`(async () => {
          const list = document.createElement('ul');
          list.id = 'results';
          document.body.append(list);
          const shadowedByTheElement = window.results === list;
          await import('/test/browser/harness.js');
          const afterTheHarnessLoaded = window.results;
          list.remove();
          return { shadowedByTheElement, afterTheHarnessLoaded };
        })()`);
        assert.deepEqual(seen, { shadowedByTheElement: true, afterTheHarnessLoaded: null });
      });
    } finally {
      await page?.close().catch(() => {});
      await browser?.close().catch(() => {});
      await server.stop();
      t.diagnostic(`wall ${Math.round(performance.now() - started)} ms`);
    }
  },
);

test('serve: a PORT=0 child prints its URL and stop() takes it down', { timeout: 15_000 }, async () => {
  const server = await serve({ args: ['server.mjs'], env: { PORT: '0' } });
  try {
    assert.match(server.url, /^http:\/\/localhost:\d+$/);
    const port = Number(new URL(server.url).port);
    assert.notEqual(port, 0, `no real port in ${server.url}`);
    const response = await fetch(`${server.url}/api/todos`);
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  } finally {
    await server.stop();
  }
  await assert.rejects(fetch(`${server.url}/`), 'the server still answers after stop()');
});

test('serve: a port something else is already listening on is refused before anything is spawned', { timeout: 15_000 }, async () => {
  // The poll answers from whatever is listening, so without this check serve() would hand back a
  // URL for a stranger's server and every assertion after it would read as a content failure.
  const squatter = createServer((_request, response) => response.end('not the server under test'));
  await new Promise((resolve) => squatter.listen(4951, '127.0.0.1', () => resolve(undefined)));
  try {
    const before = performance.now();
    await assert.rejects(serve({ args: ['server.mjs'], env: { PORT: '4951' }, port: 4951 }), {
      message: /^serve: node server\.mjs cannot have port 4951: EADDRINUSE\. Something is already listening there/,
    });
    assert.ok(performance.now() - before < 2000, 'refused before spawning, not after a poll timeout');
  } finally {
    await new Promise((resolve) => squatter.close(() => resolve(undefined)));
  }
  // And with the port free again the same call works, so the check refuses only what is taken.
  const server = await serve({ args: ['server.mjs'], env: { PORT: '4951' }, port: 4951 });
  assert.equal(server.url, 'http://127.0.0.1:4951');
  await server.stop();
});

test('serve: a child that exits before answering rejects at once, naming the command and the port', { timeout: 15_000 }, async () => {
  const started = performance.now();
  await assert.rejects(serve({ args: ['-e', 'console.error("no such server"); process.exit(3)'], port: 4950 }), {
    message: /^serve: node -e .* exited \(code 3\) before answering on port 4950\.\nno such server$/s,
  });
  assert.ok(performance.now() - started < 5000, 'waited for the timeout instead of the exit');
});
