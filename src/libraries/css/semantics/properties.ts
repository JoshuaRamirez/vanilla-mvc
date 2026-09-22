import { cardProperties } from './card.ts';
import { dialogProperties } from './dialog.ts';
import { fieldProperties } from './field-group.ts';
import { navProperties } from './nav.ts';
import { type Properties } from './names.ts';
import { toastProperties } from './toast.ts';
import { toolbarProperties } from './toolbar.ts';

/** The engine's custom properties: the six composites' knobs; every foreign name the sheets read — NAMES plus what the Effects and Animation parts they compose read; nothing overridden. */
export const properties: Properties = Object.freeze({
  defines: Object.freeze([
    ...cardProperties.defines,
    ...toolbarProperties.defines,
    ...fieldProperties.defines,
    ...dialogProperties.defines,
    ...toastProperties.defines,
    ...navProperties.defines,
  ]),
  reads: Object.freeze([
    ...new Set([...cardProperties.reads, ...toolbarProperties.reads, ...fieldProperties.reads, ...dialogProperties.reads, ...toastProperties.reads, ...navProperties.reads]),
  ]),
  overrides: Object.freeze([]),
});
