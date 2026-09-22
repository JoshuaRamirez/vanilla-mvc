import { field, html, prevent, Template } from '../../../framework/index.ts';
import type { TodoListPageController } from './todo-list-page.controller.ts';
import type { TodoListPageModel } from './todo-list-page.model.ts';

export const todoListPageTemplate = new Template<TodoListPageModel, TodoListPageController>(
  (m, c) => html`
    <section class="page todos">
      <h1>Todos</h1>
      <form class="add" @submit=${prevent(c.handler('add'))}>
        <input id="todo-draft" placeholder="What needs doing?" autocomplete="off" .value=${m.draft} @input=${field(c.handler('changeDraft'))}>
        <button ?disabled=${!m.canAdd}>Add</button>
      </form>

      <div class="toolbar">
        <nav class="filters">
          ${m.tabs.map((tab) => html`<a href=${tab.href} class=${tab.active ? 'active' : ''}>${tab.label}</a>`)}
        </nav>
        <input type="search" class="search" placeholder="Search" aria-label="Search" .value=${m.query} @input=${field(c.handler('search'))}>
      </div>

      ${!m.loaded
        ? html`<p class="empty">Loading…</p>`
        : m.empty
          ? html`<p class="empty">${m.emptyMessage}</p>`
          : html`
              <ul class="todo-list">
                ${m.rowKeys.map((key) => html`<li data-component=${key}></li>`)}
              </ul>
            `}

      <footer>
        <span>${m.footerText}</span>
        <button ?disabled=${!m.canClearCompleted} @click=${c.handler('clearCompleted')}>Clear completed</button>
      </footer>
    </section>
  `,
);
