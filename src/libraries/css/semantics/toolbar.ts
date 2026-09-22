import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, space } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

/** A toolbar landmark has a name: either the text itself, or the id of the visible heading that names it. One is required at the type level; when both are given, labelledBy wins. */
export type ToolbarName = { label: string } | { labelledBy: string };

export type ToolbarInputs = ToolbarName & {
  /** Default horizontal, which is the role's own default and so absent. */
  orientation?: 'horizontal' | 'vertical';
  /** Along the main axis, in either orientation. Default start. */
  align?: 'start' | 'center' | 'end' | 'between';
  /** Default wrap. */
  overflow?: 'wrap' | 'scroll';
};

export interface ToolbarAttributes {
  /** Written bare: `<div data-toolbar role="toolbar">`. */
  readonly 'data-toolbar': true;
  readonly role: 'toolbar';
  /** `aria-label=`; null when unnamed or when labelledBy names it. */
  readonly 'aria-label': string | null;
  /** `aria-labelledby=` */
  readonly 'aria-labelledby': string | null;
  /** `aria-orientation=`; horizontal is the default, so null. */
  readonly 'aria-orientation': 'vertical' | null;
  /** `data-toolbar-align=`; start is the base rule, so null. */
  readonly 'data-toolbar-align': 'center' | 'end' | 'between' | null;
  /** `data-toolbar-overflow=`; wrap is the base rule, so null. */
  readonly 'data-toolbar-overflow': 'scroll' | null;
}

const toolbarOptions: readonly string[] = Object.freeze(['label', 'labelledBy', 'orientation', 'align', 'overflow']);

/** Pure, deterministic; the record is frozen. An empty string is no name; labelledBy wins over label. Refuses a non-object and an unknown key by name (TypeError). */
export function toolbarAttributes(inputs: ToolbarInputs): ToolbarAttributes {
  options('toolbarAttributes', inputs, toolbarOptions);
  const labelledBy = 'labelledBy' in inputs && inputs.labelledBy ? inputs.labelledBy : null;
  const label = labelledBy === null && 'label' in inputs && inputs.label ? inputs.label : null;
  const align = inputs.align;
  return Object.freeze({
    'data-toolbar': true as const,
    role: 'toolbar' as const,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'aria-orientation': inputs.orientation === 'vertical' ? ('vertical' as const) : null,
    'data-toolbar-align': align === 'center' || align === 'end' || align === 'between' ? align : null,
    'data-toolbar-overflow': inputs.overflow === 'scroll' ? ('scroll' as const) : null,
  });
}

/**
 * Regions: `[role="group"]` for grouped controls (a tighter gap inside, --toolbar-gap between),
 * `hr` or `[role="separator"]` for a rule. Controls keep the page's own look; the sheet sets only
 * their disabled cursor and the focus ring. Alignment follows the main axis, so one rule serves
 * both orientations.
 */
const own = `/* semantics: toolbar */
[data-toolbar] {
  --toolbar-gap: ${space('3')};
  --toolbar-padding: ${space('2')};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--toolbar-gap);
  padding: var(--toolbar-padding);
  min-inline-size: 0;
}
[data-toolbar][aria-orientation="vertical"] { flex-direction: column; align-items: stretch; }
[data-toolbar][data-toolbar-align="center"] { justify-content: center; }
[data-toolbar][data-toolbar-align="end"] { justify-content: flex-end; }
[data-toolbar][data-toolbar-align="between"] { justify-content: space-between; }
[data-toolbar][data-toolbar-overflow="scroll"] { flex-wrap: nowrap; overflow: auto; }
[data-toolbar] [role="group"] { display: flex; flex-wrap: wrap; align-items: center; gap: ${space('1')}; }
[data-toolbar][aria-orientation="vertical"] [role="group"] { flex-direction: column; align-items: stretch; }
[data-toolbar] :is(hr, [role="separator"]) { align-self: stretch; margin: 0; border: 0; border-inline-start: 1px solid ${color('border')}; }
[data-toolbar][aria-orientation="vertical"] :is(hr, [role="separator"]) { border-inline-start: 0; border-block-start: 1px solid ${color('border')}; }
[data-toolbar] :disabled { cursor: default; }
[data-toolbar] :focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
`;

const sheet: StyleResult = css`${own}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function toolbarRules(): StyleResult {
  return sheet;
}

export const toolbarProperties: Properties = Object.freeze({
  defines: Object.freeze(['--toolbar-gap', '--toolbar-padding']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
