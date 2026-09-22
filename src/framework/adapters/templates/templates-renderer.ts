import { analyze, ElementBehavior, render, ViewResult } from '../../../libraries/templates/index.ts';
import { isDelivered } from '../../delivery.ts';
import type { ElementBehaviorResult, IRenderer } from '../../seams.ts';

/** IRenderer on libraries/templates. Child component placeholders are boundaries. */
export class TemplatesRenderer implements IRenderer {
  html(strings: TemplateStringsArray, values: unknown[]): ViewResult {
    refuseUndelivered(strings, values);
    return new ViewResult(strings, values);
  }

  behavior(apply: (element: Element) => void): ElementBehaviorResult {
    return new ElementBehavior(apply);
  }

  render(view: ViewResult, target: HTMLElement): void {
    render(view, target, { boundary: '[data-component]' });
  }
}

/**
 * Every event position holds nothing, or a function the change engine will hear from — a
 * controller's `handler('name')`, or a view helper built on one. Anything else is refused here,
 * when the template is built, because it would otherwise run on a click, write the model and draw
 * nothing: see delivery.ts. `analyze` is cached per template, so this costs a loop per render.
 */
function refuseUndelivered(strings: TemplateStringsArray, values: unknown[]): void {
  const holes = analyze(strings);
  for (let i = 0; i < holes.length; i++) {
    const { kind, name } = holes[i];
    const value = values[i];
    if (kind !== 'event' || value == null || isDelivered(value)) continue;
    throw new TypeError(
      `@${name} is bound to a function no controller registered, so the change engine will never ` +
        `hear from it: the click would run, write the model, and leave the screen as it was.\n` +
        `Register it in the controller — this.handle('save', this.#save) in onInterconnect — and ` +
        `bind @${name}=\${c.handler('save')}. prevent(), field(), formValues() and keys() keep ` +
        `the registration when they wrap a registered handler.`,
    );
  }
}
