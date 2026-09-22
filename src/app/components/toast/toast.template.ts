import { html, nothing, Template } from '../../../framework/index.ts';
import type { ToastController } from './toast.controller.ts';
import type { ToastModel } from './toast.model.ts';

export const toastTemplate = new Template<ToastModel, ToastController>(
  (m, c) => html`
    <div class="status" role="status">
      ${m.visible
        ? html`
            <p class="toast ${m.tone}">
              <span>${m.text}</span>
              ${m.canRetry ? html`<button class="action" @click=${c.handler('retry')}>Retry</button>` : nothing}
              <button class="close" title="Dismiss" @click=${c.handler('dismiss')}>✕</button>
            </p>
          `
        : nothing}
    </div>
  `,
);
