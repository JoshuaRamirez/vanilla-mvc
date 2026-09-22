// Launching Chrome and speaking the DevTools protocol to it. No third parties:
// node:child_process starts the browser, Node's global WebSocket carries CDP.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { Page } from './page.mjs';

/**
 * Where Chrome, or Chromium, usually lives on each platform. Absolute paths are tried as they
 * are; a bare name is looked up on PATH, which is how Linux installs it.
 */
const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', '/snap/bin/chromium'],
  win32: [
    `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
};

/** `name` as an absolute path: itself if absolute, else the first match on PATH. */
function located(name) {
  if (name.includes('/') || name.includes('\\')) return existsSync(name) ? name : null;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    for (const ext of process.platform === 'win32' ? ['.exe', ''] : ['']) {
      const path = join(dir, name + ext);
      if (dir && existsSync(path)) return path;
    }
  }
  return null;
}

/**
 * Where Chrome lives on this machine when nothing says otherwise: the first candidate for this
 * platform that exists, else the first candidate, so the "No browser" error names a real path.
 */
export const DEFAULT_CHROME = (() => {
  const list = CANDIDATES[process.platform] ?? CANDIDATES.linux;
  for (const name of list) {
    const path = located(name);
    if (path) return path;
  }
  return list[0];
})();

// CI machines are slow and several suites launch Chrome at once, so it gets longer there. Chrome
// printing nothing in 15 s on a loaded runner is not a broken browser; it is a browser still starting.
const LAUNCH_TIMEOUT = process.env.CI ? 60_000 : 15_000;
const EXIT_TIMEOUT = 5_000;

/**
 * The Chrome binary launch() will try: the argument, then $CHROME, then the first browser found
 * for this platform — Chrome or Chromium, on macOS, Linux or Windows.
 * @param {string} [chrome]
 */
export function chromePath(chrome) {
  return chrome ?? process.env.CHROME ?? DEFAULT_CHROME;
}

/**
 * Whether `promise` settles within `ms`. The timer is cleared either way, so a
 * won race leaves nothing holding the event loop open.
 * @param {Promise<unknown>} promise
 * @param {number} ms
 * @returns {Promise<boolean>}
 */
function settlesWithin(promise, ms) {
  let timer;
  const expiry = new Promise((resolve) => (timer = setTimeout(() => resolve(false), ms)));
  return Promise.race([promise.then(() => true, () => true), expiry]).finally(() => clearTimeout(timer));
}

/**
 * One DevTools connection. Commands carry an id and resolve on the matching
 * reply; events dispatch by method and session.
 */
export class Session {
  /** @type {WebSocket} */
  #socket;
  #nextId = 1;
  /** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void, method: string }>} */
  #pending = new Map();
  /** @type {Map<string, Set<(params: any) => void>>} */
  #listeners = new Map();

  /** @param {WebSocket} socket */
  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', (event) => this.#receive(String(event.data)));
    socket.addEventListener('close', () => this.#fail(new Error('the DevTools connection closed')));
    socket.addEventListener('error', () => this.#fail(new Error('the DevTools connection failed')));
  }

  /**
   * Send a command; resolves with its result, rejects on a protocol error.
   * @param {string} method
   * @param {Record<string, unknown>} [params]
   * @param {string} [sessionId] the page session the command belongs to; none for browser-level commands
   * @returns {Promise<any>}
   */
  send(method, params = {}, sessionId) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  /**
   * Listen for an event on a session. Returns the function that stops listening.
   * @param {string} method
   * @param {string | undefined} sessionId
   * @param {(params: any) => void} handler
   */
  on(method, sessionId, handler) {
    const key = `${sessionId ?? ''}:${method}`;
    if (!this.#listeners.has(key)) this.#listeners.set(key, new Set());
    this.#listeners.get(key).add(handler);
    return () => this.#listeners.get(key)?.delete(handler);
  }

  close() {
    this.#socket.close();
  }

  /** @param {string} raw */
  #receive(raw) {
    const message = JSON.parse(raw);
    if (message.id !== undefined) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
      return;
    }
    for (const handler of this.#listeners.get(`${message.sessionId ?? ''}:${message.method}`) ?? []) handler(message.params);
  }

  /** @param {Error} error */
  #fail(error) {
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
  }
}

/** A running Chrome: pages come from it, and close() takes everything down. */
export class Browser {
  /** @type {import('node:child_process').ChildProcess} */
  #process;
  /** @type {Session} */
  #session;
  /** @type {string} */
  #userDataDir;
  /** @type {() => void} */
  #killOnExit;

  /**
   * @param {import('node:child_process').ChildProcess} process
   * @param {Session} session
   * @param {string} userDataDir
   * @param {() => void} killOnExit
   */
  constructor(process, session, userDataDir, killOnExit) {
    this.#process = process;
    this.#session = session;
    this.#userDataDir = userDataDir;
    this.#killOnExit = killOnExit;
  }

  /** A new tab on about:blank, attached and ready to drive. */
  async newPage() {
    const { targetId } = await this.#session.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.#session.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this.#session, sessionId, targetId);
    await page.attach();
    return page;
  }

  /** Close the browser, kill it if it lingers, and remove its profile directory. */
  async close() {
    const exited = new Promise((resolve) => {
      if (this.#process.exitCode !== null || this.#process.signalCode !== null) resolve(undefined);
      else this.#process.once('exit', () => resolve(undefined));
    });
    // The socket may close before the reply arrives; the exit wait below is what matters.
    await settlesWithin(this.#session.send('Browser.close'), EXIT_TIMEOUT);
    this.#session.close();
    if (!(await settlesWithin(exited, EXIT_TIMEOUT))) {
      this.#process.kill('SIGKILL');
      await exited;
    }
    process.off('exit', this.#killOnExit);
    await rm(this.#userDataDir, { recursive: true, force: true });
  }
}

/**
 * Start Chrome headless with a fresh profile and connect to its DevTools endpoint.
 * @param {{ chrome?: string, headless?: boolean }} [options]
 * @returns {Promise<Browser>}
 */
export async function launch({ chrome, headless = true } = {}) {
  const binary = chromePath(chrome);
  try {
    await access(binary);
  } catch {
    throw new Error(`No browser: nothing at ${binary}. Set CHROME or pass { chrome }.`);
  }

  const userDataDir = await mkdtemp(join(tmpdir(), 'vanillamvc-chrome-'));
  const args = [
    ...(headless ? ['--headless'] : []),
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Linux CI runners (Ubuntu 23.10 and later) forbid the unprivileged user namespaces Chrome's
    // sandbox needs, and root cannot sandbox at all. The page is our own test, not the web.
    // /dev/shm is small in containers, and there is no GPU: with neither flag Chrome starts and
    // then sits there, which arrives as "printed no DevTools URL" rather than as a crash.
    ...(process.platform === 'linux' && (process.env.CI || process.getuid?.() === 0)
      ? ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      : []),
    'about:blank',
  ];
  const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const killOnExit = () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  };
  process.once('exit', killOnExit);

  try {
    const url = await devToolsUrl(child, binary);
    const socket = await connect(url);
    return new Browser(child, new Session(socket), userDataDir, killOnExit);
  } catch (error) {
    killOnExit();
    process.off('exit', killOnExit);
    await rm(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Read `DevTools listening on ws://…` from Chrome's stderr, within the launch timeout.
 * Keeps draining stderr afterwards so a full pipe can never stall the browser.
 * @param {import('node:child_process').ChildProcess} child
 * @param {string} binary
 * @returns {Promise<string>}
 */
function devToolsUrl(child, binary) {
  return new Promise((resolve, reject) => {
    let recent = '';
    let found = false;
    const remember = (chunk) => (recent = (recent + chunk).slice(-4096));
    const fail = (why) => {
      if (found) return;
      found = true;
      clearTimeout(timer);
      reject(new Error(`Chrome at ${binary} ${why}.${recent.trim() ? `\n${recent.trim()}` : ''}`));
    };
    const timer = setTimeout(() => fail(`printed no DevTools URL within ${LAUNCH_TIMEOUT} ms`), LAUNCH_TIMEOUT);

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      remember(chunk);
      if (found) return;
      const match = recent.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!match) return;
      found = true;
      clearTimeout(timer);
      resolve(match[1]);
    });
    child.once('error', (error) => fail(`could not start: ${error.message}`));
    child.once('exit', (code, signal) => fail(`exited before it was ready (${signal ?? `code ${code}`})`));
  });
}

/**
 * @param {string} url
 * @returns {Promise<WebSocket>}
 */
function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', () => reject(new Error(`could not open the DevTools socket at ${url}`)), { once: true });
  });
}
