import { html, modal, nothing, prevent, Template } from '../../../framework/index.ts';
import type { ConfirmDialogController } from './confirm-dialog.controller.ts';
import type { ConfirmDialogModel } from './confirm-dialog.model.ts';

export const confirmDialogTemplate = new Template<ConfirmDialogModel, ConfirmDialogController>(
  (m, c) => html`
    <dialog class="confirm danger" ${modal(m.open)} @cancel=${prevent(c.handler('decline'))}>
      ${m.open
        ? html`
            <h2>${m.title}</h2>
            <p>${m.message}</p>
            <div class="actions">
              <button @click=${c.handler('decline')}>${m.cancelLabel}</button>
              <button class="primary" @click=${c.handler('accept')}>${m.confirmLabel}</button>
            </div>
          `
        : nothing}
    </dialog>
  `,
);
