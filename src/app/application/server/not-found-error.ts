/** The server has no such record. */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}
