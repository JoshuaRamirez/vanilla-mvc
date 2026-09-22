import { analyze } from './analyze.ts';

/** The result of a css`` template: its static strings and the values between them. */
export class StyleResult {
  readonly strings: TemplateStringsArray;
  readonly values: readonly unknown[];

  constructor(strings: TemplateStringsArray, values: readonly unknown[]) {
    this.strings = strings;
    this.values = values;
  }
}

/**
 * A stylesheet. The position of each ${} in the static CSS decides what it does:
 *
 *   .card { padding: ${x}; }          value: bound live as a custom property; a CSS-wide keyword is written
 *   .sel-${x} { }  @media (${x}) { }  text: verbatim, no { } ; or comment
 *   content: "${x}"                   string: escaped
 *   ${css`…`}  ${nothing}  ${{ … }}   rule, at the start of a statement: a nested sheet, an array of them,
 *                                     raw css text, or a declaration block whose values bind live
 *
 * Static mistakes (unbalanced braces, an open string, a hole in a comment) throw here, at the call site.
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): StyleResult {
  analyze(strings);
  return new StyleResult(strings, values);
}
