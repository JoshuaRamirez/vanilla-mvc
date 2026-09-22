import { css, serialize, type StyleResult } from '../templates/index.ts';
import { color, radius, space, text, weight } from '../theme/index.ts';
import { options, type Properties, readsOf } from './names.ts';

export interface FieldGroupInputs {
  /** Labels beside controls instead of above: data-field-group-inline. */
  inline?: boolean;
  /** Disables every control the native way: `<fieldset disabled>`. */
  disabled?: boolean;
}

export interface FieldGroupAttributes {
  /** Written bare: `<fieldset data-field-group>`. */
  readonly 'data-field-group': true;
  /** `?data-field-group-inline=` */
  readonly 'data-field-group-inline': boolean;
  /** `?disabled=`; the sheet reads `:disabled`. */
  readonly disabled: boolean;
}

const groupOptions: readonly (keyof FieldGroupInputs)[] = Object.freeze(['inline', 'disabled']);
const fieldOptions: readonly (keyof FieldInputs)[] = Object.freeze(['id', 'hint', 'invalid']);

/** Pure, deterministic; the record is frozen. Refuses a non-object and an unknown key by name (TypeError). */
export function fieldGroupAttributes(inputs: FieldGroupInputs = {}): FieldGroupAttributes {
  options('fieldGroupAttributes', inputs, groupOptions);
  return Object.freeze({
    'data-field-group': true as const,
    'data-field-group-inline': inputs.inline === true,
    disabled: inputs.disabled === true,
  });
}

export interface FieldInputs {
  /** The control's id, unique on the page; the hint's and the error's ids derive from it. Non-empty, no whitespace, else fieldAttributes throws a RangeError. */
  id: string;
  /** A hint element is rendered under hint.id, so the control is described by it. */
  hint?: boolean;
  /** The value was rejected: aria-invalid on the control, and an error element under error.id describes it, first. */
  invalid?: boolean;
}

/** One record per element of the field, keyed by the element's part; each key is the literal attribute name. */
export interface FieldAttributes {
  readonly label: { readonly for: string };
  readonly control: {
    readonly id: string;
    /** `aria-invalid=`; never "false". */
    readonly 'aria-invalid': 'true' | null;
    /** `aria-describedby=`: "<error.id> <hint.id>", either, or null. */
    readonly 'aria-describedby': string | null;
  };
  readonly hint: { readonly id: string };
  readonly error: { readonly id: string };
}

/** Pure and deterministic; ids are a function of `id` alone; every record is frozen. Throws a RangeError on an id that would break `for` and the derived ids; a TypeError on a non-object or an unknown key. */
export function fieldAttributes(inputs: FieldInputs): FieldAttributes {
  options('fieldAttributes', inputs, fieldOptions);
  const id = inputs.id;
  if (typeof id !== 'string' || id === '' || /\s/.test(id)) {
    throw new RangeError(`semantics: fieldAttributes: id is ${JSON.stringify(id)}; give a non-empty string with no whitespace`);
  }
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = inputs.invalid === true;
  const describedBy = [invalid ? errorId : '', inputs.hint === true ? hintId : ''].filter(Boolean).join(' ');
  return Object.freeze({
    label: Object.freeze({ for: id }),
    control: Object.freeze({ id, 'aria-invalid': invalid ? ('true' as const) : null, 'aria-describedby': describedBy || null }),
    hint: Object.freeze({ id: hintId }),
    error: Object.freeze({ id: errorId }),
  });
}

/**
 * Regions: `<legend>` (native); one `[data-field]` per field holding `<label for>`, the control,
 * `[data-field-hint]` and `[data-field-error]` — the three data-field* markers exist because HTML
 * has no element for them. Inline versus stacked goes through two inherited knobs the group
 * declares and the modifier reassigns, so a nested group re-declares them and is isolated.
 * Invalid reads the attribute the control already carries, and `:user-invalid` for constraint
 * validation with no script; the group's legend follows through `:has()`. An empty error element
 * is hidden, so the always-rendered live region (index.ts header) costs no space when there is
 * no error.
 */
const own = `/* semantics: field group */
[data-field-group] {
  --field-gap: ${space('3')};
  --field-label-width: 10rem;
  --field-columns: 1fr;
  --field-message-column: auto;
  display: grid;
  gap: var(--field-gap);
  margin: 0;
  padding: ${space('3')} ${space('4')};
  min-inline-size: 0;
  border: 1px solid ${color('border')};
  border-radius: ${radius('md')};
}
[data-field-group] > legend { padding: 0 ${space('1')}; font-weight: ${weight('medium')}; }
[data-field-group][data-field-group-inline] { --field-columns: var(--field-label-width) 1fr; --field-message-column: 2; }
[data-field-group]:disabled { color: ${color('text-muted')}; }
[data-field-group]:has([aria-invalid="true"]) > legend { color: ${color('danger')}; }
[data-field] {
  display: grid;
  grid-template-columns: var(--field-columns);
  gap: ${space('1')} ${space('3')};
  align-items: baseline;
  min-inline-size: 0;
}
[data-field] > label { font-weight: ${weight('medium')}; }
[data-field] > :is([data-field-hint], [data-field-error]) { grid-column: var(--field-message-column); margin: 0; font-size: ${text('sm')}; }
[data-field-hint] { color: ${color('text-muted')}; }
[data-field-error] { color: ${color('danger')}; }
[data-field-error]:empty { display: none; }
[data-field] :is([aria-invalid="true"], :user-invalid) { border-color: ${color('danger')}; outline-color: ${color('danger')}; }
[data-field-group] :focus-visible { outline: 2px solid ${color('focus')}; outline-offset: 2px; }
`;

const sheet: StyleResult = css`${own}`;

/** One StyleResult, built once: `===` on every call. The shell applies it at the document. */
export function fieldGroupRules(): StyleResult {
  return sheet;
}

export const fieldProperties: Properties = Object.freeze({
  defines: Object.freeze(['--field-gap', '--field-label-width', '--field-columns', '--field-message-column']),
  reads: readsOf(serialize(sheet).text),
  overrides: Object.freeze([]),
});
