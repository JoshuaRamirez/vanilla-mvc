import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, radius, shadow, space, text, weight } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

/** A dialog has a name: the text itself, or the id of the visible heading that names it. One is required at the type level; when both are given, labelledBy wins. */
export type DialogName = { label: string } | { labelledBy: string };

export type DialogInputs = DialogName & {
  /** Confirming loses something: the confirm control takes the danger colour. Default false. */
  danger?: boolean;
};

export interface DialogAttributes {
  /** Written bare: `<dialog data-dialog>`. */
  readonly 'data-dialog': true;
  /** `aria-label=`; null when labelledBy names it. */
  readonly 'aria-label': string | null;
  /** `aria-labelledby=` */
  readonly 'aria-labelledby': string | null;
  /** `?data-dialog-danger=` */
  readonly 'data-dialog-danger': boolean;
}

const dialogOptions: readonly string[] = Object.freeze(['label', 'labelledBy', 'danger']);

/** Pure, deterministic; the record is frozen. An empty string is no name; labelledBy wins over label. Refuses a non-object and an unknown key by name (TypeError). */
export function dialogAttributes(inputs: DialogInputs): DialogAttributes {
  options('dialogAttributes', inputs, dialogOptions);
  const labelledBy = 'labelledBy' in inputs && inputs.labelledBy ? inputs.labelledBy : null;
  const label = labelledBy === null && 'label' in inputs && inputs.label ? inputs.label : null;
  return Object.freeze({
    'data-dialog': true as const,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'data-dialog-danger': inputs.danger === true,
  });
}

/**
 * The element is `<dialog>`, opened with showModal(): HTML has the element, the backdrop, the top
 * layer and the Escape key, and nothing here re-implements any of them. Regions are HTML too — the
 * question is a heading, the explanation a paragraph, the answers a `<footer>` — and the gap is the
 * rhythm, so the direct children lose their own margins. The one marker is `[data-dialog-confirm]`,
 * on the control that carries out the action: HTML has no element for "the affirmative answer", and
 * without it `danger` would have nothing to colour.
 *
 * Display is never set in the base rule: a `<dialog>` is `display: none` until it is open, and a
 * base-rule `display: grid` would draw a closed one. `:is([open], :modal)` is there twice over —
 * `:modal` because the morph strips the `open` attribute the UA sheet keys on, `[open]` because a
 * non-modal dialog is never `:modal`.
 *
 * The backdrop colour is a literal, not a knob: `::backdrop` inherited from the root element rather
 * than from its originating element until Chrome 122, and the styling seam's floor is Chrome 118, so a
 * `--dialog-backdrop` declared on `[data-dialog]` would not resolve there.
 */
const own = `/* semantics: dialog */
[data-dialog] {
  --dialog-padding: ${space('5')};
  --dialog-gap: ${space('4')};
  --dialog-inline-size: 24rem;
  max-inline-size: var(--dialog-inline-size);
  padding: var(--dialog-padding);
  border: none;
  border-radius: ${radius('lg')};
  background: ${color('surface-raised')};
  color: ${color('text')};
  box-shadow: ${shadow('lg')};
}
[data-dialog]:is([open], :modal) { display: grid; align-content: start; gap: var(--dialog-gap); }
[data-dialog]::backdrop { background: rgb(0 0 0 / 0.35); }
[data-dialog] > :is(h1, h2, h3) { margin-block: 0; font-size: ${text('lg')}; font-weight: ${weight('medium')}; }
[data-dialog] > p { margin-block: 0; color: ${color('text-muted')}; }
[data-dialog] > footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: ${space('2')}; }
[data-dialog] [data-dialog-confirm] { background: ${color('accent')}; color: ${color('on-accent')}; border-color: transparent; }
[data-dialog][data-dialog-danger] [data-dialog-confirm] { background: ${color('danger')}; }
[data-dialog] :focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
`;

const sheet: StyleResult = css`${own}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function dialogRules(): StyleResult {
  return sheet;
}

export const dialogProperties: Properties = Object.freeze({
  defines: Object.freeze(['--dialog-padding', '--dialog-gap', '--dialog-inline-size']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
