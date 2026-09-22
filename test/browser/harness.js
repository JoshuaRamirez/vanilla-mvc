// A tiny in-browser test runner: the judge of test/browser/index.html.
// Owned by browser-testing. Its contract — what each of the four counts
// counts, when window.results may be read, how a test registers, and what a
// failure carries — is stated once, in
// docs/decisions/the-browser-harness-contract.md.
//
// The page this runs on provides #summary, #results and #fixtures.

// `results` is also the id of the page's <ul>, and the window exposes an element
// by its id: until run() assigned it, window.results was that <ul>, which a driver
// reads as a result object with no counts (round 2: css-theme and css-layout both
// tripped on it). Shadowing it here, at load, makes the window property null from
// the first moment any test file can observe it, and the results object after run().
/** @type {any} */ (window).results = null;

const tests = [];
const skipped = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export const assert = {
  equal(actual, expected, message = '') {
    if (!Object.is(actual, expected)) throw new Error(`${message} expected ${show(expected)}, got ${show(actual)}`);
  },
  deepEqual(actual, expected, message = '') {
    if (show(actual) !== show(expected)) throw new Error(`${message} expected ${show(expected)}, got ${show(actual)}`);
  },
  ok(value, message = 'expected truthy') {
    if (!value) throw new Error(message);
  },
  throws(fn, pattern) {
    try {
      fn();
    } catch (error) {
      if (pattern && !pattern.test(String(error.message))) throw new Error(`threw "${error.message}", expected ${pattern}`);
      return;
    }
    throw new Error('expected to throw');
  },
};

/** A test file the page did not run — it is not on disk — reported by name, failing nothing. */
export function skip(file, reason) {
  skipped.push({ file, reason });
}

/** A scratch element in the document, removed after the test. */
export function fixture(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.getElementById('fixtures').append(host);
  return host;
}

export async function run() {
  const results = { passed: 0, failed: 0, failures: [], skipped: skipped.map((s) => s.file) };
  const list = document.getElementById('results');
  for (const { file, reason } of skipped) {
    const item = document.createElement('li');
    item.textContent = `– ${file} skipped: ${reason}`;
    item.className = 'skip';
    list.append(item);
  }
  for (const { name, fn } of tests) {
    const item = document.createElement('li');
    try {
      await fn();
      results.passed++;
      item.textContent = `✔ ${name}`;
    } catch (error) {
      results.failed++;
      results.failures.push({ name, error: String(error.message ?? error) });
      item.textContent = `✖ ${name}: ${error.message ?? error}`;
      item.className = 'fail';
    } finally {
      document.getElementById('fixtures').replaceChildren();
    }
    list.append(item);
  }
  // results before the summary: a reader that waits on #summary changing is then
  // certain window.results is the finished object, never a half-written one.
  /** @type {any} */ (window).results = results;
  document.getElementById('summary').textContent = `${results.passed} passed, ${results.failed} failed, ${results.skipped.length} skipped`;
  return results;
}

function show(value) {
  return JSON.stringify(value, (_, v) => (v instanceof Element ? `<${v.tagName.toLowerCase()}>` : v));
}
