import { field, html, Template } from '../../../framework/index.ts';
import type { CounterController } from './counter.controller.ts';
import type { CounterModel } from './counter.model.ts';

export const counterTemplate = new Template<CounterModel, CounterController>(
  (m, c) => html`
    <div class="counter">
      <button @click=${c.handler('decrement')}>−</button>
      <output>${m.count}</output>
      <button @click=${c.handler('increment')}>+</button>
      <label>step <input type="number" min="1" .value=${m.step} @input=${field(c.handler('stepChanged'))}></label>
      <button ?disabled=${!m.canReset} @click=${c.handler('reset')}>reset</button>
    </div>
  `,
);
