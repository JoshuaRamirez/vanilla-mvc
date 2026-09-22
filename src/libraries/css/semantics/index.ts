/**
 * semantics: composites — card, toolbar, field group, dialog, toast, nav — each an attribute
 * record a template writes with `attrs()`, plus the sheet that reads it.
 *
 * A record's keys are literal attribute names; the engine spells them and a template never does.
 * A state is the ARIA or native attribute assistive technology already reads, so there is no data
 * twin to keep in step.
 *
 * ./README.md has the binding and state rules, every complete fragment, what an author writes,
 * the sheets, the channels and the knobs.
 */
export { type CardAttributes, type CardInputs, type CardRole, cardAttributes, cardProperties, cardRoles, cardRules } from './card.ts';
export { type DialogAttributes, type DialogInputs, type DialogName, dialogAttributes, dialogProperties, dialogRules } from './dialog.ts';
export {
  type FieldAttributes,
  type FieldGroupAttributes,
  type FieldGroupInputs,
  type FieldInputs,
  fieldAttributes,
  fieldGroupAttributes,
  fieldGroupRules,
  fieldProperties,
} from './field-group.ts';
export { type NavAttributes, type NavInputs, type NavLinkAttributes, type NavLinkInputs, type NavName, navAttributes, navLinkAttributes, navProperties, navRules } from './nav.ts';
export { attributes, type Name, NAMES, type Properties } from './names.ts';
export { properties } from './properties.ts';
export { type ToastAttributes, type ToastInputs, type ToastTone, toastAttributes, toastProperties, toastRules } from './toast.ts';
export { type ToolbarAttributes, type ToolbarInputs, type ToolbarName, toolbarAttributes, toolbarProperties, toolbarRules } from './toolbar.ts';
