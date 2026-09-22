import { field, focus, html, keys, nothing, Template } from '../../../framework/index.ts';
import type { TodoRowController } from './todo-row.controller.ts';
import type { TodoRowModel } from './todo-row.model.ts';

export const todoRowTemplate = new Template<TodoRowModel, TodoRowController>(
  (m, c) => html`
    <div class="todo-row ${m.done ? 'done' : ''} ${m.overdue ? 'overdue' : ''}">
      <input type="checkbox" aria-label="Done" .checked=${m.done} @change=${c.handler('toggle')}>
      ${m.renaming
        ? html`<input
            class="rename"
            aria-label="Title"
            .value=${m.title}
            ${focus(true)}
            @keydown=${keys({ Enter: field(c.handler('rename')), Escape: c.handler('stopRenaming') })}
            @blur=${c.handler('stopRenaming')}
          >`
        : html`<span class="title" title="Double-click to rename" @dblclick=${c.handler('startRenaming')}>${m.title}</span>`}
      ${m.highPriority ? html`<span class="pill high">high</span>` : nothing}
      ${m.tags.map((tag) => html`<span class="pill">${tag}</span>`)}
      ${m.dueLabel ? html`<span class="due">${m.dueLabel}</span>` : nothing}
      <a class="edit" href=${m.editHref}>Edit</a>
      <button class="remove" title="Delete" @click=${c.handler('remove')}>✕</button>
    </div>
  `,
);
