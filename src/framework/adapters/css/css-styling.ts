import { apply, css, release } from '../../../libraries/css/templates/index.ts';
import type { IStyling, StyleResult } from '../../seams.ts';

/** IStyling on libraries/css/templates. Child component placeholders bound a scope: its rules stop at their views. */
export class CssStyling implements IStyling {
  css(strings: TemplateStringsArray, values: unknown[]): StyleResult {
    return css(strings, ...values);
  }

  apply(style: StyleResult, scope: Document | HTMLElement): void {
    apply(style, scope, { boundary: '[data-component] > *' });
  }

  release(scope: Document | HTMLElement): void {
    release(scope);
  }
}
