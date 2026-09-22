// Dev server: static files, SPA fallback, and a small todo API.
// Business rules live here, on the server, not in the client.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 4400);
const ROOT = import.meta.dirname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml' };

const PRIORITIES = ['low', 'normal', 'high'];
const TAGS = ['home', 'work', 'errand', 'urgent'];

let nextId = 4;
let todos = [
  { id: 1, title: 'Write a framework without a virtual DOM', notes: '', priority: 'high', due: null, tags: ['work'], done: true },
  { id: 2, title: 'Tell people about it', notes: 'Start with the README.', priority: 'normal', due: '2026-10-01', tags: ['work'], done: false },
  { id: 3, title: 'Buy milk', notes: '', priority: 'low', due: null, tags: ['errand', 'home'], done: false },
];

class Rejected extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

// ---- Business rules ----

function checkTitle(title, exceptId, fields) {
  const trimmed = String(title ?? '').trim();
  if (!trimmed) fields.title = 'A todo needs a title.';
  else if (trimmed.length > 80) fields.title = 'Keep it under 80 characters.';
  else if (todos.some((t) => t.id !== exceptId && t.title.toLowerCase() === trimmed.toLowerCase())) fields.title = 'That todo already exists.';
  return trimmed;
}

function validate(body, exceptId) {
  const fields = {};
  const todo = { title: checkTitle(body.title, exceptId, fields) };

  todo.notes = String(body.notes ?? '');
  if (todo.notes.length > 500) fields.notes = 'Notes are limited to 500 characters.';

  todo.priority = body.priority ?? 'normal';
  if (!PRIORITIES.includes(todo.priority)) fields.priority = 'Pick low, normal, or high.';

  todo.due = body.due || null;
  if (todo.due !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(todo.due) || Number.isNaN(Date.parse(todo.due)))) fields.due = 'That is not a date.';
  else if (todo.due !== null && todo.due < '2000-01-01') fields.due = 'Due dates start in 2000.';

  todo.tags = Array.isArray(body.tags) ? [...new Set(body.tags)] : [];
  if (todo.tags.some((tag) => !TAGS.includes(tag))) fields.tags = `Tags are ${TAGS.join(', ')}.`;

  todo.done = Boolean(body.done);

  if (Object.keys(fields).length) throw new Rejected(422, 'Some fields need attention.', fields);
  return todo;
}

function find(id) {
  const todo = todos.find((t) => t.id === Number(id));
  if (!todo) throw new Rejected(404, 'No such todo.');
  return todo;
}

async function api(req, res, path) {
  await new Promise((r) => setTimeout(r, 150)); // pretend there's a network
  if (req.headers['x-simulate-failure']) throw new Rejected(503, 'The server is having a moment. Try again.');

  const [, , , id] = path.split('/'); // /api/todos/:id

  if (path === '/api/todos' && req.method === 'GET') return json(res, 200, todos);
  if (path === '/api/todos' && req.method === 'POST') {
    const fields = {};
    const title = checkTitle((await readBody(req)).title, null, fields);
    if (fields.title) throw new Rejected(422, fields.title, fields);
    todos.push({ id: nextId++, title, notes: '', priority: 'normal', due: null, tags: [], done: false });
    return json(res, 201, todos);
  }
  if (path === '/api/todos/completed' && req.method === 'DELETE') {
    todos = todos.filter((t) => !t.done);
    return json(res, 200, todos);
  }

  const todo = find(id);
  if (req.method === 'GET') return json(res, 200, todo);
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    if ('title' in body) {
      const fields = {};
      const title = checkTitle(body.title, todo.id, fields);
      if (fields.title) throw new Rejected(422, fields.title, fields);
      todo.title = title;
    }
    if ('done' in body) todo.done = Boolean(body.done);
    return json(res, 200, todos);
  }
  if (req.method === 'PUT') {
    Object.assign(todo, validate(await readBody(req), todo.id));
    return json(res, 200, todos);
  }
  if (req.method === 'DELETE') {
    todos = todos.filter((t) => t !== todo);
    return json(res, 200, todos);
  }
  throw new Rejected(405, 'Method not allowed.');
}

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (path.startsWith('/api/')) return await api(req, res, path);
    const file = normalize(join(ROOT, path));
    const isAsset = file.startsWith(ROOT) && extname(file) && !file.includes('node_modules');
    const body = await readFile(isAsset ? file : join(ROOT, 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[isAsset ? extname(file) : '.html'] ?? 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    if (error instanceof Rejected) return json(res, error.status, { error: error.message, fields: error.fields });
    if (error.code === 'ENOENT') return json(res, 404, { error: 'Not found.' });
    if (error instanceof SyntaxError) return json(res, 400, { error: 'Bad JSON.' });
    console.error(error);
    json(res, 500, { error: 'Server error.' });
  }
}).listen(PORT, function () { console.log(`http://localhost:${this.address().port}`); });
