import { html, Template } from '../../../framework/index.ts';
import type { ShellController } from './shell.controller.ts';
import type { ShellModel } from './shell.model.ts';

export const shellTemplate = new Template<ShellModel, ShellController>(
  (m) => html`
    <div class="shell">
      <header data-component="nav-bar"></header>
      <main data-component=${m.page}></main>
      <aside data-component="toast"></aside>
      <div data-component="confirm-dialog"></div>
    </div>
  `,
);
