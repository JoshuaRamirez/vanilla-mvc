import type { TokenName } from '../theme/index.ts';

/**
 * The Theme names this engine's own text reads, each through a Theme reader, so the fallback is
 * Theme's default and lives only there. One list: the test derives the same set from the sheets'
 * text, the foreign parts subtracted, and asserts both directions. `properties.reads` is this plus
 * what the parts this engine composes read — Effects' elevation, lift and transition, Animation's
 * timeline.
 */
export const NAMES = Object.freeze([
  '--color-surface-raised',
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-on-accent',
  '--color-border',
  '--color-focus',
  '--color-danger',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--text-sm',
  '--text-lg',
  '--weight-medium',
  '--weight-bold',
  '--radius-md',
  '--radius-lg',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
] as const satisfies readonly TokenName[]);

export type Name = (typeof NAMES)[number];

/** The foreign properties one sheet reads: every `var(--x, …)` with a fallback, in first-seen order. */
export function readsOf(text: string): readonly string[] {
  return Object.freeze([...new Set([...text.matchAll(/var\((--[\w-]+),/g)].map(([, name]) => name!))]);
}

/** The shape every composite and the engine export under `properties`. */
export interface Properties {
  readonly defines: readonly string[];
  readonly reads: readonly string[];
  readonly overrides: readonly string[];
}

/** An inputs argument: an object (or absent, where the function has a default) whose keys are all options. Refused by name otherwise. */
export function options(fn: string, given: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof given !== 'object' || given === null || Array.isArray(given)) {
    throw new TypeError(`semantics: ${fn}: the inputs are ${given === null ? 'null' : Array.isArray(given) ? 'an array' : typeof given}; give an object with ${keys.join(', ')}`);
  }
  for (const key of Object.keys(given)) {
    if (!keys.includes(key)) throw new TypeError(`semantics: ${fn}: ${JSON.stringify(key)} is not an option; the options are ${keys.join(', ')}`);
  }
  return given as Record<string, unknown>;
}

/** The attribute hooks, keyed by option word: a consumer reads `attributes.card`, never writes `'data-card'`. */
export const attributes = Object.freeze({
  card: 'data-card',
  toolbar: 'data-toolbar',
  fieldGroup: 'data-field-group',
  field: 'data-field',
  fieldHint: 'data-field-hint',
  fieldError: 'data-field-error',
  dialog: 'data-dialog',
  dialogConfirm: 'data-dialog-confirm',
  toast: 'data-toast',
  toastNotice: 'data-toast-notice',
  toastDismiss: 'data-toast-dismiss',
  nav: 'data-nav',
  navBrand: 'data-nav-brand',
  navTitle: 'data-nav-title',
} as const);
