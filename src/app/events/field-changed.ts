/** A field the user committed a change to. */
export interface FieldChanged {
  readonly field: string;
  readonly previous: unknown;
  readonly value: unknown;
}
