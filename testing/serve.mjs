// Starting a server as a child process for a test to drive, and taking it down
// again. Nothing here speaks CDP; it is spawn, poll and kill.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const READY_TIMEOUT = 10_000;
const TERM_PATIENCE = 2_000;
const POLL_INTERVAL = 50;
const TAIL = 4096;

// Awaited inside a bounded loop, never raced: the timer is ref'd on purpose, so a
// child that failed to spawn still gets its 'error' seen at the next turn.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @typedef {{ url: string, stop: () => Promise<void> }} Server */

/**
 * Spawn `command` with `args` and wait until it serves.
 *
 * The child runs in `cwd`, which defaults to the caller's working directory, so `args` are the
 * paths the caller would type. This harness ships as part of the `vanilla-mvc` package, so it may
 * well be sitting in the caller's `node_modules`; resolving against its own folder would send
 * every relative path into the package. That happened.
 *
 * With `port > 0`, `http://127.0.0.1:<port>/` is polled until it answers and
 * `url` is that origin. With `port` 0 or absent the child chooses its port
 * (pass `PORT: '0'` in `env` for the repo's servers) and `url` is the first
 * `http://localhost:<n>` or `http://127.0.0.1:<n>` the child prints on stdout.
 * Rejects after 10 s naming the command and the port, with the last 4 KB of
 * the child's output. The child is killed on `stop()` and at process exit.
 *
 * A named port already in use is refused before the child is spawned. Without that check the poll
 * below answers from whatever was already listening: the child dies of EADDRINUSE, `serve()` hands
 * back a URL, and the test drives a stranger's server while reporting its assertions as content
 * failures. That happened — an application binary left running on 4600, which is this repo's own
 * browser-test port, and four tests failed saying the page had the wrong title.
 * @param {{ command?: string, args?: string[], env?: Record<string, string>, port?: number, cwd?: string }} [options]
 * @returns {Promise<Server>}
 */
export async function serve({ command = 'node', args = [], env = {}, port = 0, cwd = process.cwd() } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`serve: bad port ${JSON.stringify(port)}`);
  const what = `${command} ${args.join(' ')}`.trim();
  if (port > 0) await refuseIfTaken(port, what);
  const binary = command === 'node' ? process.execPath : command;
  const child = spawn(binary, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  const killOnExit = () => {
    if (!exited()) child.kill('SIGKILL');
  };
  process.once('exit', killOnExit);
  /** @type {Error | undefined} */
  let failed;
  // One listener for the child's life: an unheard 'error' would crash the caller.
  child.on('error', (error) => (failed = error));

  // Both pipes drained for the child's whole life; a full pipe would block it.
  let output = '';
  let stdout = '';
  const remember = (chunk) => (output = (output + chunk).slice(-TAIL));
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout = (stdout + chunk).slice(-TAIL);
    remember(chunk);
  });
  child.stderr.on('data', remember);

  const where = port > 0 ? `port ${port}` : 'a port of its own (PORT=0)';
  const describe = (why) => `serve: ${what} ${why} on ${where}.${output.trim() ? `\n${output.trim()}` : ''}`;

  try {
    const url = await (port > 0 ? answers(child, port, () => failed, describe) : printsUrl(child, () => stdout, describe));
    return {
      url,
      async stop() {
        process.off('exit', killOnExit);
        if (exited()) return;
        const gone = new Promise((resolve) => child.once('exit', () => resolve(undefined)));
        child.kill('SIGTERM');
        const patience = setTimeout(() => child.kill('SIGKILL'), TERM_PATIENCE);
        await gone;
        clearTimeout(patience);
      },
    };
  } catch (error) {
    killOnExit();
    process.off('exit', killOnExit);
    throw error;
  }
}

/**
 * Refuse a port something is already listening on, before anything is spawned. Bindability is the
 * test: a listener that binds and closes cleanly proves the port is the caller's to take, where a
 * request to it would only prove something answers — which is exactly the thing being ruled out.
 * @param {number} port
 * @param {string} what the command, for the message
 */
function refuseIfTaken(port, what) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) =>
      reject(
        new Error(
          `serve: ${what} cannot have port ${port}: ${/** @type {NodeJS.ErrnoException} */ (error).code ?? error.message}. ` +
            `Something is already listening there, and polling it would answer — so the test would drive that instead. ` +
            `Stop it (lsof -nP -iTCP:${port} -sTCP:LISTEN), or pass port 0 and let the child choose.`,
        ),
      ),
    );
    probe.once('listening', () => probe.close(() => resolve(undefined)));
    probe.listen(port, '127.0.0.1');
  });
}

/**
 * Poll the port until any HTTP answer comes back, within the ready timeout.
 * @param {import('node:child_process').ChildProcess} child
 * @param {number} port
 * @param {() => Error | undefined} failed the child's 'error', if it raised one
 * @param {(why: string) => string} describe
 * @returns {Promise<string>}
 */
async function answers(child, port, failed, describe) {
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + READY_TIMEOUT;
  while (Date.now() < deadline) {
    if (failed()) throw new Error(describe(`could not start: ${failed().message}`));
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(describe(`exited (${child.signalCode ?? `code ${child.exitCode}`}) before answering`));
    }
    try {
      const response = await fetch(`${origin}/`);
      await response.arrayBuffer();
      return origin;
    } catch {
      await sleep(POLL_INTERVAL);
    }
  }
  throw new Error(describe(`did not answer within ${READY_TIMEOUT} ms`));
}

/**
 * Wait for the child to print its URL, within the ready timeout.
 * @param {import('node:child_process').ChildProcess} child
 * @param {() => string} stdout the output so far
 * @param {(why: string) => string} describe
 * @returns {Promise<string>}
 */
function printsUrl(child, stdout, describe) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.off('data', look);
      child.off('exit', onExit);
      child.off('error', onError);
      fn(value);
    };
    const look = () => {
      const match = stdout().match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/);
      if (match) settle(resolve, match[0]);
    };
    const onExit = (code, signal) => settle(reject, new Error(describe(`exited (${signal ?? `code ${code}`}) before printing its URL`)));
    const onError = (error) => settle(reject, new Error(describe(`could not start: ${error.message}`)));
    const timer = setTimeout(() => settle(reject, new Error(describe(`printed no http://localhost:<port> line within ${READY_TIMEOUT} ms`))), READY_TIMEOUT);
    child.stdout.on('data', look);
    child.once('exit', onExit);
    child.once('error', onError);
    look();
  });
}
