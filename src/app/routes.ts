import { Routes } from '../framework/index.ts';

export const routes = new Routes([
  { name: 'home', path: '/' },
  { name: 'todos', path: '/todos/:filter(active|completed)?' },
  { name: 'todo', path: '/todos/:id(\\d+)' },
  { name: 'old-home', path: '/home', redirect: '/' },
]);
