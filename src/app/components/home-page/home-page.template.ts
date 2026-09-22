import { html, Template } from '../../../framework/index.ts';
import type { HomePageController } from './home-page.controller.ts';
import type { HomePageModel } from './home-page.model.ts';

export const homePageTemplate = new Template<HomePageModel, HomePageController>(
  (m, c) => html`
    <section class="page home">
      <h1>${m.title}</h1>
      <p>Create. Interconnect. Activate. Render. Every element in this page followed that order.</p>
      <div data-component="counter"></div>

      <h2>Scenarios</h2>
      <table class="scenarios">
        <thead><tr><th>Scenario</th><th>Stretches</th><th>Try it</th></tr></thead>
        <tbody>
          ${m.scenarios.map((s) => html`<tr><td><a href=${s.href}>${s.name}</a></td><td>${s.stretches}</td><td>${s.tryIt}</td></tr>`)}
        </tbody>
      </table>

      <p class="tools">
        <button @click=${c.handler('failNextRequest')}>Fail the next request</button>
        <a href="/nowhere">A page that doesn't exist</a>
      </p>
    </section>
  `,
);
