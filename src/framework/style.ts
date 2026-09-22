import { adapters } from './adapters/adapters.ts';
import type { StyleResult } from './seams.ts';
import { behavior } from './view.ts';

/**
 * A stylesheet, built by the installed styling library. The position of each ${}
 * decides what it does (see src/libraries/css/templates/README.md).
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): StyleResult {
  return adapters.styling.css(strings, values);
}

/**
 * A component's style: a function of the model returning a css`` sheet, beside its
 * Template. Mounted on the template's root with styled(); rules reach that element
 * and its subtree and stop at child components.
 *
 *   export const cardStyle = new Style<CardModel>((m) => css`
 *     :scope { padding: ${m.dense ? '4px' : '12px'}; }
 *   `);
  * see docs/decisions/no-css-tag-at-module-scope.md, docs/decisions/bind-a-measurement-class-a-state.md
 */
export class Style<TModel extends object = any> {
  readonly rules: (model: TModel) => StyleResult;

  constructor(rules: (model: TModel) => StyleResult) {
    this.rules = rules;
  }

  apply(model: TModel, scope: Document | HTMLElement): void {
    adapters.styling.apply(this.rules(model), scope);
  }
}

/** Apply a style to the element it sits on, after every render: <article ${styled(cardStyle, m)}>. */
export const styled = behavior((element, style: Style<any>, model: unknown) => style.apply(model, element as HTMLElement));
