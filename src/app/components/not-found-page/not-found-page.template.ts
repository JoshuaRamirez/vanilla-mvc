import { html, Template } from '../../../framework/index.ts';
import type { NotFoundPageController } from './not-found-page.controller.ts';
import type { NotFoundPageModel } from './not-found-page.model.ts';

export const notFoundPageTemplate = new Template<NotFoundPageModel, NotFoundPageController>(
  (m) => html`
    <section class="page">
      <h1>Not found</h1>
      <p>Nothing lives at <code>${m.path}</code>. <a href=${m.homeHref}>Go home</a>.</p>
    </section>
  `,
);
