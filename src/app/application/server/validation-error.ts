import { FieldErrors } from './field-errors.ts';

/** The server refused a change; fields says why, per field. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';

  constructor(
    message: string,
    readonly fields: FieldErrors = FieldErrors.none,
  ) {
    super(message);
  }
}
