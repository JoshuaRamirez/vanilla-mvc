// The browser page's verdict: serve the repo on 4601 as a child
// through serve(), drive test/browser/index.html headlessly and require that
// every test on it passed, naming each failure and each engine file the page
// skipped. The driver itself is tested by test/browser-testing.test.mjs (4600);
// this file judges the page. Skips loudly when there is no Chrome.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { chromePath, launch, serve } from '../testing/index.mjs';

const PORT = 4601; // 4600 is browser-testing's; node --test runs the files at once
const PAGE = `http://127.0.0.1:${PORT}/test/browser/index.html`; // the file name matters: /test/browser/ is the SPA fallback
const FILE_BUDGET = 60_000;
const PAGE_BUDGET = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // always awaited, never raced

const chrome = chromePath();
const hasChrome = await access(chrome).then(() => true, () => false);

/** @type {import('../testing/index.mjs').Server | undefined} */
let server;
/** @type {import('../testing/index.mjs').Browser | undefined} */
let browser;
/** @type {import('../testing/index.mjs').Page | undefined} */
let page;

after(async () => {
  await page?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await server?.stop();
});

test(
  'browser-page: every test on /test/browser/index.html passes',
  { timeout: FILE_BUDGET, skip: hasChrome ? false : `no Chrome at ${chrome}; set CHROME to a binary` },
  async (t) => {
    server = await serve({ args: ['server.mjs'], env: { PORT: String(PORT) }, port: PORT });
    browser = await launch({ chrome });
    page = await browser.newPage();
    await page.goto(PAGE);

    const deadline = Date.now() + PAGE_BUDGET;
    while ((await page.text('#summary')) === 'Running…') {
      assert.ok(Date.now() < deadline, `#summary still "Running…" after ${PAGE_BUDGET} ms; page errors: ${JSON.stringify(page.errors())}`);
      await sleep(100);
    }

    // The harness reports { passed, failed, failures: [{ name, error }], skipped: [file] }.
    const results = await page.evaluate('window.results');
    const skipped = results.skipped ?? [];
    const lines = [`${results.passed} passed, ${results.failed} failed, ${skipped.length} skipped`];
    for (const { name, error } of results.failures) lines.push(`  ✖ ${name}: ${error}`);
    if (skipped.length) lines.push(`  skipped (not on disk): ${skipped.join(', ')}`);
    const errors = page.errors();
    if (errors.length) lines.push(`  page errors: ${JSON.stringify(errors)}`);
    const report = lines.join('\n');
    t.diagnostic(report);

    assert.ok(results.passed > 0, `the page ran no tests at all:\n${report}`);
    assert.equal(results.failed, 0, `${results.failed} browser test(s) failed:\n${report}`);
  },
);
