import { html, nothing, Template } from '../../../framework/index.ts';
import type { NavBarController } from './nav-bar.controller.ts';
import type { NavBarModel } from './nav-bar.model.ts';

export const navBarTemplate = new Template<NavBarModel, NavBarController>(
  (m) => html`
    <nav class="nav">
      <a class="brand" href=${m.homeHref}>VanillaMVC</a>
      <a href=${m.homeHref} class=${m.homeActive ? 'active' : ''}>Home</a>
      <a href=${m.todosHref} class=${m.todosActive ? 'active' : ''}>
        Todos${m.hasBadge ? html`<span class="badge">${m.remaining}</span>` : nothing}
      </a>
    </nav>
  `,
);
