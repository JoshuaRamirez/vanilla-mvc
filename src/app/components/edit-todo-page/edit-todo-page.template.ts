import { field, fill, formValues, html, nothing, prevent, Template } from '../../../framework/index.ts';
import type { EditTodoPageController } from './edit-todo-page.controller.ts';
import type { EditTodoPageModel } from './edit-todo-page.model.ts';

const fieldError = (message: string | undefined) => (message ? html`<small class="error">${message}</small>` : nothing);

/**
 * An uncontrolled form: fill() writes the session's values in through the
 * form seam, and formValues() reads the whole form back out on every input
 * and on submit.
 */
export const editTodoPageTemplate = new Template<EditTodoPageModel, EditTodoPageController>(
  (m, c) => html`
    <section class="page editor">
      <p><a href=${m.listHref}>← All todos</a></p>
      ${m.missing
        ? html`<h1>Todo not found</h1><p class="empty">It may have been deleted.</p>`
        : m.loading
          ? html`<p class="empty">Loading…</p>`
          : html`
              <h1>Edit todo ${m.dirty ? html`<span class="pill dirty">unsaved</span>` : nothing}</h1>
              <form class="edit-form" novalidate ${fill(m.formValues ?? {})} @input=${formValues(c.handler('change'))} @change=${field(c.handler('fieldChanged'))} @submit=${prevent(formValues(c.handler('save')))}>
                <label>
                  <span>Title</span>
                  <input name="title" autocomplete="off" aria-invalid=${m.errors.title ? 'true' : 'false'}>
                  ${fieldError(m.errors.title)}
                </label>
                <label>
                  <span>Notes</span>
                  <textarea name="notes" rows="3"></textarea>
                  ${fieldError(m.errors.notes)}
                </label>
                <fieldset>
                  <legend>Priority</legend>
                  ${m.priorities.map((p) => html`<label class="inline"><input type="radio" name="priority" value=${p}> ${p}</label>`)}
                  ${fieldError(m.errors.priority)}
                </fieldset>
                <label>
                  <span>Due</span>
                  <input type="date" name="due" aria-invalid=${m.errors.due ? 'true' : 'false'}>
                  ${fieldError(m.errors.due)}
                </label>
                <fieldset>
                  <legend>Tags</legend>
                  ${m.tags.map((t) => html`<label class="inline"><input type="checkbox" name="tags[]" value=${t}> ${t}</label>`)}
                  ${fieldError(m.errors.tags)}
                </fieldset>
                <label class="inline"><input type="checkbox" name="done" value="true"> Done</label>
                <p class="last-change">
                  ${m.lastChangeText ? html`Last change: ${m.lastChangeText}` : html`Change a field to see its previous and new value.`}
                </p>
                <div class="actions">
                  <button type="button" ?disabled=${!m.dirty || m.saving} @click=${c.handler('revert')}>Revert</button>
                  <button class="primary" ?disabled=${!m.canSave}>${m.saveLabel}</button>
                </div>
              </form>
            `}
    </section>
  `,
);
