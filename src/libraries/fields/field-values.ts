/**
 * Uniform values for form fields, whatever their type:
 *
 *   text, textarea, date, select   → string
 *   number, range                  → number, or null when empty
 *   checkbox (alone)               → boolean
 *   checkbox group (name[] or shared name), select[multiple] → string[]
 *   radio group                    → the checked value, or null
 *   file                           → File[]
 */

export type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const NOT_VALUES = new Set(['submit', 'reset', 'button', 'image']);

export function isField(node: unknown): node is FormField {
  return node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement;
}

/** Name as a key: `tags[]` → `tags`. */
export function keyOf(name: string): string {
  return name.endsWith('[]') ? name.slice(0, -2) : name;
}

/** Where a field's group lives: its form, or its document/shadow root. */
export function scopeOf(field: FormField): ParentNode {
  return field.form ?? (field.getRootNode() as ParentNode);
}

/** The other inputs sharing this radio or checkbox's name, including itself. */
export function peersOf(field: HTMLInputElement): HTMLInputElement[] {
  if (!field.name) return [field];
  return [...scopeOf(field).querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(field.name)}"]`)].filter(
    (peer) => peer.type === field.type,
  );
}

/** Radios always group; checkboxes group when named `x[]` or when several share a name. */
export function isGrouped(field: FormField): boolean {
  if (!(field instanceof HTMLInputElement) || !field.name) return false;
  if (field.type === 'radio') return true;
  return field.type === 'checkbox' && (field.name.endsWith('[]') || peersOf(field).length > 1);
}

export function readField(field: FormField): unknown {
  if (field instanceof HTMLSelectElement) {
    return field.multiple ? [...field.selectedOptions].map((o) => o.value) : field.value;
  }
  if (field instanceof HTMLInputElement) {
    switch (field.type) {
      case 'radio':
        return peersOf(field).find((peer) => peer.checked)?.value ?? null;
      case 'checkbox':
        return isGrouped(field) ? peersOf(field).filter((peer) => peer.checked).map((peer) => peer.value) : field.checked;
      case 'number':
      case 'range':
        return Number.isNaN(field.valueAsNumber) ? null : field.valueAsNumber;
      case 'file':
        return [...(field.files ?? [])];
    }
  }
  return field.value;
}

/** What the field held before the user touched it (from its default attributes). */
export function readDefault(field: FormField): unknown {
  if (field instanceof HTMLSelectElement) {
    const selected = [...field.options].filter((o) => o.defaultSelected).map((o) => o.value);
    return field.multiple ? selected : (selected[0] ?? field.options[0]?.value ?? '');
  }
  if (field instanceof HTMLInputElement) {
    switch (field.type) {
      case 'radio':
        return peersOf(field).find((peer) => peer.defaultChecked)?.value ?? null;
      case 'checkbox':
        return isGrouped(field) ? peersOf(field).filter((p) => p.defaultChecked).map((p) => p.value) : field.defaultChecked;
      case 'number':
      case 'range':
        return field.defaultValue === '' ? null : Number(field.defaultValue);
      case 'file':
        return [];
    }
  }
  return field.defaultValue;
}

/** Set a field (or its whole group) to a value. Only touches the DOM where it differs. */
export function writeField(field: FormField, value: unknown): void {
  if (field instanceof HTMLSelectElement) {
    if (field.multiple) {
      const wanted = new Set(toStrings(value));
      for (const option of field.options) option.selected = wanted.has(option.value);
    } else if (value == null) {
      // Cleared: back to the first option, as a form reset would.
      if (field.selectedIndex !== 0 && field.options.length) field.selectedIndex = 0;
    } else if (field.value !== text(value)) {
      field.value = text(value);
    }
    return;
  }
  if (field instanceof HTMLInputElement) {
    switch (field.type) {
      case 'radio':
        for (const peer of peersOf(field)) setChecked(peer, value != null && peer.value === String(value));
        return;
      case 'checkbox':
        if (isGrouped(field)) {
          const wanted = new Set(toStrings(value));
          for (const peer of peersOf(field)) setChecked(peer, wanted.has(peer.value));
        } else {
          setChecked(field, value === true || value === 'true' || value === field.value);
        }
        return;
      case 'number':
      case 'range':
        if (readField(field) !== value) field.value = text(value);
        return;
      case 'file':
        return; // browsers don't allow it
    }
  }
  if (field.value !== text(value)) field.value = text(value);
}

/** The named, enabled fields in a container, one per group. */
export function fieldsOf(container: ParentNode): FormField[] {
  const seen = new Set<string>();
  const fields: FormField[] = [];
  for (const field of container.querySelectorAll<FormField>('input[name], select[name], textarea[name]')) {
    if (field.disabled || (field instanceof HTMLInputElement && NOT_VALUES.has(field.type))) continue;
    if (isGrouped(field)) {
      if (seen.has(field.name)) continue;
      seen.add(field.name);
    }
    fields.push(field);
  }
  return fields;
}

/** A container's fields as an object keyed by name (`tags[]` → `tags`). */
export function readForm(container: ParentNode): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fieldsOf(container)) {
    const key = keyOf(field.name);
    const value = readField(field);
    // Several plain fields named x[] collect into an array.
    if (field.name.endsWith('[]') && !isGrouped(field) && !(field instanceof HTMLSelectElement && field.multiple)) {
      values[key] = [...toStrings(values[key]), ...toStrings(value)];
    } else {
      values[key] = value;
    }
  }
  return values;
}

/** Replace a container's field values by name. Fields not named are cleared. */
export function writeForm(container: ParentNode, values: Record<string, unknown>): void {
  for (const field of fieldsOf(container)) writeField(field, values[keyOf(field.name)]);
}

function setChecked(input: HTMLInputElement, checked: boolean): void {
  if (input.checked !== checked) input.checked = checked;
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function toStrings(value: unknown): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}
