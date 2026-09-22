import { type Timeline, timeline } from '../animation/index.ts';
import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, radius, shadow, space } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

/**
 * How urgently the message must be heard. info is the polite live region every page keeps open;
 * error is the assertive one. The tone is the region's role — there is no colour word beside it to
 * keep in step, and what a reader hears matches what a reader sees.
 */
export type ToastTone = 'info' | 'error';

export interface ToastInputs {
  /** Default 'info'. */
  tone?: ToastTone;
}

export interface ToastAttributes {
  /** Written bare: `<div data-toast>`. */
  readonly 'data-toast': true;
  /** `role=`; the live region is always one or the other, so this key is never null. */
  readonly role: 'status' | 'alert';
}

const toastOptions: readonly (keyof ToastInputs)[] = Object.freeze(['tone']);

/** Pure, deterministic; the record is frozen. Refuses a non-object and an unknown key by name (TypeError). */
export function toastAttributes(inputs: ToastInputs = {}): ToastAttributes {
  options('toastAttributes', inputs, toastOptions);
  return Object.freeze({
    'data-toast': true as const,
    role: inputs.tone === 'error' ? ('alert' as const) : ('status' as const),
  });
}

/**
 * THE PLACEMENT IS THE COMPOSITE'S. The region is a block at the end of the flow, never a
 * layer over the page: no position, no inset, no z-index anywhere in this sheet, so a notice can
 * never cover a page's action row. It is a grid with no padding of its own, so while it holds no
 * notice it is a live region of zero height — present in the accessibility tree before the text
 * arrives, which is the whole reason the region and the notice are two elements.
 *
 * Regions: `[data-toast-notice]` is one message, `[data-toast-dismiss]` the control that closes it.
 * HTML has an element for neither. Any other control inside a notice keeps the page's own look, as
 * the toolbar's controls do.
 *
 * The entrance is Animation's: timeline() on the notice's selector, composed after the sheet's own
 * text. Every duration in it is a `--duration-*` token, so `prefers-reduced-motion: reduce` zeroes
 * it through Animation's tokens() with no rule here. There is no exit: the notice leaves by being
 * removed from the DOM, and holding an element alive for its own exit is the framework's business,
 * not a sheet's.
 */
const enter: Timeline = { name: 'toast-enter', steps: ['fade-in', 'slide-up'] };

const own = `/* semantics: toast */
[data-toast] {
  --toast-gap: ${space('2')};
  --toast-padding: ${space('3')} ${space('4')};
  display: grid;
  justify-items: end;
  gap: var(--toast-gap);
  min-inline-size: 0;
}
[data-toast] [data-toast-notice] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--toast-gap);
  margin-block: 0;
  padding: var(--toast-padding);
  max-inline-size: 100%;
  border: 1px solid ${color('border')};
  border-radius: ${radius('md')};
  background: ${color('surface-raised')};
  color: ${color('text')};
  box-shadow: ${shadow('md')};
}
[data-toast][role="alert"] [data-toast-notice] { border-color: ${color('danger')}; color: ${color('danger')}; }
[data-toast] [data-toast-dismiss] { border: none; background: none; color: ${color('text-muted')}; }
[data-toast] :focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
`;

/** Animation's rule on the notice's selector, composed last. */
const entrance = timeline(enter, '[data-toast] [data-toast-notice]');

const sheet: StyleResult = css`${own}
${entrance}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function toastRules(): StyleResult {
  return sheet;
}

export const toastProperties: Properties = Object.freeze({
  defines: Object.freeze(['--toast-gap', '--toast-padding']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
