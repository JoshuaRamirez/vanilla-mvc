// One page on one DevTools session: navigation, real input, reads, and the
// errors the page raised while it was driven.
import { writeFile } from 'node:fs/promises';

const LOAD_TIMEOUT = 30_000;
const VIEWPORT_TIMEOUT = 2_000;
const POLL_INTERVAL = 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Named keys as Chrome's own layout tables have them. A printable character
 * is derived; anything else press() does not know is rejected.
 * @type {Record<string, { code: string, windowsVirtualKeyCode: number, text?: string }>}
 */
const KEYS = {
  Enter: { code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Escape: { code: 'Escape', windowsVirtualKeyCode: 27 },
  Tab: { code: 'Tab', windowsVirtualKeyCode: 9 },
  Backspace: { code: 'Backspace', windowsVirtualKeyCode: 8 },
  Delete: { code: 'Delete', windowsVirtualKeyCode: 46 },
  ArrowUp: { code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  ArrowDown: { code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
  ArrowRight: { code: 'ArrowRight', windowsVirtualKeyCode: 39 },
  Home: { code: 'Home', windowsVirtualKeyCode: 36 },
  End: { code: 'End', windowsVirtualKeyCode: 35 },
  PageUp: { code: 'PageUp', windowsVirtualKeyCode: 33 },
  PageDown: { code: 'PageDown', windowsVirtualKeyCode: 34 },
  ' ': { code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
};

/**
 * @param {string} key
 * @returns {{ key: string, code: string, windowsVirtualKeyCode: number, text?: string }}
 */
function keyDefinition(key) {
  if (KEYS[key]) return { key, ...KEYS[key] };
  if (key.length !== 1) throw new Error(`press: unknown key "${key}"`);
  const upper = key.toUpperCase();
  const code = /[A-Z]/.test(upper) ? `Key${upper}` : /[0-9]/.test(key) ? `Digit${key}` : '';
  return { key, code, windowsVirtualKeyCode: upper.charCodeAt(0), text: key };
}

/** An uncaught exception or a console.error the page raised. */
/** @typedef {{ message: string, source: 'exception' | 'console' }} PageError */

export class Page {
  /** @type {import('./cdp.mjs').Session} */
  #session;
  /** @type {string} */
  #sessionId;
  /** @type {string} */
  #targetId;
  /** @type {PageError[]} */
  #errors = [];
  /** @type {(() => void)[]} */
  #offs = [];

  /**
   * @param {import('./cdp.mjs').Session} session
   * @param {string} sessionId
   * @param {string} targetId
   */
  constructor(session, sessionId, targetId) {
    this.#session = session;
    this.#sessionId = sessionId;
    this.#targetId = targetId;
  }

  /** Enable the domains and start collecting errors. Browser.newPage() calls this once. */
  async attach() {
    this.#offs.push(
      this.#on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
        const message = exceptionDetails.exception?.description ?? exceptionDetails.text ?? 'Uncaught exception';
        this.#errors.push({ message, source: 'exception' });
      }),
      this.#on('Runtime.consoleAPICalled', ({ type, args }) => {
        if (type !== 'error') return;
        const message = (args ?? []).map((arg) => (arg.value !== undefined ? String(arg.value) : (arg.description ?? arg.type))).join(' ');
        this.#errors.push({ message, source: 'console' });
      }),
    );
    await this.#send('Page.enable');
    await this.#send('Runtime.enable');
  }

  /**
   * Navigate and wait for the load event.
   * @param {string} url
   */
  async goto(url) {
    const loaded = this.#once('Page.loadEventFired', LOAD_TIMEOUT, `goto ${url}: no load event within ${LOAD_TIMEOUT} ms`);
    const { errorText } = await this.#send('Page.navigate', { url });
    if (errorText) {
      loaded.cancel();
      throw new Error(`goto ${url}: ${errorText}`);
    }
    await loaded;
  }

  /**
   * A real click at the element's centre: mouse moved, pressed, released.
   * @param {string} selector
   */
  async click(selector) {
    const { x, y } = await this.#element(selector, `(e) => {
      e.scrollIntoView({ block: 'center', inline: 'center' });
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }`);
    await this.#send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.#send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.#send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  /**
   * Click the element, then insert text as typed input, so input events fire.
   * @param {string} selector
   * @param {string} text
   */
  async type(selector, text) {
    await this.click(selector);
    await this.#send('Input.insertText', { text });
  }

  /**
   * Press and release one key: Enter, Escape, Tab, Backspace, the arrows, or a printable character.
   * @param {string} key
   */
  async press(key) {
    const definition = keyDefinition(key);
    await this.#send('Input.dispatchKeyEvent', { type: 'keyDown', ...definition });
    await this.#send('Input.dispatchKeyEvent', { type: 'keyUp', key: definition.key, code: definition.code, windowsVirtualKeyCode: definition.windowsVirtualKeyCode });
  }

  /**
   * The element's textContent.
   * @param {string} selector
   * @returns {Promise<string>}
   */
  text(selector) {
    return this.#element(selector, '(e) => e.textContent');
  }

  /**
   * The element's attribute, or null when it has none by that name.
   * @param {string} selector
   * @param {string} name
   * @returns {Promise<string | null>}
   */
  attribute(selector, name) {
    return this.#element(selector, `(e) => e.getAttribute(${JSON.stringify(name)})`);
  }

  /**
   * A form control's value, as `.value` reads it.
   * @param {string} selector
   * @returns {Promise<string>}
   */
  value(selector) {
    return this.#element(selector, '(e) => e.value');
  }

  /**
   * How many elements match.
   * @param {string} selector
   * @returns {Promise<number>}
   */
  count(selector) {
    return this.evaluate('(s) => document.querySelectorAll(s).length', selector);
  }

  /**
   * Poll until the selector matches something, or reject naming the selector and the timeout.
   * @param {string} selector
   * @param {{ timeout?: number }} [options]
   */
  async waitFor(selector, { timeout = 5000 } = {}) {
    const deadline = Date.now() + timeout;
    do {
      if (await this.evaluate('(s) => document.querySelector(s) !== null', selector)) return;
      await sleep(POLL_INTERVAL);
    } while (Date.now() < deadline);
    throw new Error(`waitFor: no element matched "${selector}" within ${timeout} ms`);
  }

  /**
   * Run code in the page and return its value. With no args, `expression` is
   * evaluated as it is; with args, it is the source of a function, called with
   * them. Promises are awaited. Args and the result must be JSON-serialisable.
   * @param {string} expression
   * @param {...unknown} args
   * @returns {Promise<any>}
   */
  async evaluate(expression, ...args) {
    const source = args.length ? `(${expression})(...${JSON.stringify(args)})` : expression;
    const { result, exceptionDetails } = await this.#send('Runtime.evaluate', { expression: source, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) {
      throw new Error(`evaluate: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    return result.value;
  }

  /**
   * Size the viewport; resolves once the page reports the new inner size.
   * @param {{ width: number, height: number }} size CSS pixels, whole and positive
   */
  async viewport({ width, height }) {
    const whole = (n) => Number.isInteger(n) && n > 0;
    if (!whole(width) || !whole(height)) throw new Error(`viewport: bad size ${JSON.stringify({ width, height })}; width and height must be positive integers`);
    await this.#send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const deadline = Date.now() + VIEWPORT_TIMEOUT;
    let seen;
    do {
      seen = await this.evaluate('({ width: innerWidth, height: innerHeight })');
      if (seen.width === width && seen.height === height) return;
      await sleep(POLL_INTERVAL);
    } while (Date.now() < deadline);
    throw new Error(`viewport: asked for ${width}×${height}, the page still reports ${seen.width}×${seen.height} after ${VIEWPORT_TIMEOUT} ms`);
  }

  /**
   * Save a PNG of the viewport.
   * @param {string} path
   */
  async screenshot(path) {
    const { data } = await this.#send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path, Buffer.from(data, 'base64'));
  }

  /**
   * Every uncaught exception and console.error since the page was opened, oldest first.
   * @returns {PageError[]}
   */
  errors() {
    return this.#errors.map((error) => ({ ...error }));
  }

  /** Close the tab. */
  async close() {
    for (const off of this.#offs.splice(0)) off();
    await this.#session.send('Target.closeTarget', { targetId: this.#targetId });
  }

  /**
   * Run `fn` on the first element the selector matches; reject naming the selector when none does.
   * @param {string} selector
   * @param {string} fn source of a function taking the element
   * @returns {Promise<any>}
   */
  async #element(selector, fn) {
    const outcome = await this.evaluate(
      `(s) => { const e = document.querySelector(s); return e ? { found: true, value: (${fn})(e) } : { found: false }; }`,
      selector,
    );
    if (!outcome.found) throw new Error(`no element matches "${selector}"`);
    return outcome.value;
  }

  /**
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   */
  #send(method, params = {}) {
    return this.#session.send(method, params, this.#sessionId);
  }

  /**
   * @param {string} method
   * @param {(params: any) => void} handler
   */
  #on(method, handler) {
    return this.#session.on(method, this.#sessionId, handler);
  }

  /**
   * The next occurrence of an event on this session, bounded.
   * @param {string} method
   * @param {number} timeout
   * @param {string} message what the rejection says when the event never comes
   * @returns {Promise<any> & { cancel: () => void }}
   */
  #once(method, timeout, message) {
    let off = () => {};
    let timer;
    const promise = new Promise((resolve, reject) => {
      off = this.#on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
      timer = setTimeout(() => {
        off();
        reject(new Error(message));
      }, timeout);
    });
    return Object.assign(promise, {
      cancel: () => {
        clearTimeout(timer);
        off();
      },
    });
  }
}
