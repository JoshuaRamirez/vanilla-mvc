import { adapters } from './adapters/adapters.ts';
import type { ITemplate } from './interfaces.ts';
import type { ViewResult } from './seams.ts';

/** A view function: model and controller in, view out. */
export type View<TModel, TController> = (model: TModel, controller: TController) => ViewResult;

/**
 * A view template. Rendering goes through the renderer seam, which updates
 * the existing DOM in place, so focus, selection, and scroll survive.
 *
 *   new Template<TodoListPageModel, TodoListPageController>((m, c) => html`
 *     <form @submit=${prevent(c.handler('add'))}>
 *       <input .value=${m.draft} @input=${field(c.handler('draftChanged'))}>
 *       <button ?disabled=${!m.canAdd}>Add</button>
 *     </form>
 *   `)
 *
 * Handlers are the controller's private methods, registered by name.
 */
export class Template<TModel extends object = any, TController extends object = any> implements ITemplate {
  constructor(readonly view: View<TModel, TController>) {}

  render(model: TModel, controller: TController, target: HTMLElement): HTMLElement {
    adapters.renderer.render(this.view(model, controller), target);
    adapters.forms.remember(target); // newly rendered fields start with their rendered value
    if (target.childElementCount !== 1) {
      throw new Error(`A template must render exactly one root element, got ${target.childElementCount}`);
    }
    return target.firstElementChild as HTMLElement;
  }
}
