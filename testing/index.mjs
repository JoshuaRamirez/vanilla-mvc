// The testing library: a Node program driving headless Chrome over the
// DevTools protocol. node:test is the runner; this is the driver.
//
//   const browser = await launch();
//   const page = await browser.newPage();
//   await page.goto('http://127.0.0.1:4500/');
//   await page.click('a[href="/memory"]');
//   await page.waitFor('.memory-list');
//   assert.equal(await page.text('h1'), 'Memory');
//   await page.close();
//   await browser.close();
//
// The page this library's own test drives, test/browser/index.html, is judged by
// test/browser/harness.js (browser-testing's). What its
// { passed, failed, failures, skipped } means, and when window.results may be read,
// is stated once in docs/decisions/the-browser-harness-contract.md.
//
// A server under test is a child: serve() spawns it, waits until it answers,
// and stop() takes it down.
//
//   const server = await serve({ args: ['server.mjs'], env: { PORT: '0' } });
//   await page.goto(server.url);
//   …
//   await server.stop();
export { launch, chromePath, DEFAULT_CHROME } from './cdp.mjs';
export { serve } from './serve.mjs';

/** @typedef {import('./cdp.mjs').Browser} Browser */
/** @typedef {import('./page.mjs').Page} Page  goto, click, type, press, text, attribute, value, count, waitFor, evaluate, viewport, screenshot, errors, close */
/** @typedef {import('./page.mjs').PageError} PageError */
/** @typedef {import('./serve.mjs').Server} Server  { url, stop() } */
