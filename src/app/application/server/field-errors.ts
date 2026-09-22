/** Per-field messages from the server's validation. Immutable. */
export class FieldErrors {
  static readonly none = new FieldErrors({});

  /** Public so change detection sees it. */
  readonly messages: Readonly<Record<string, string>>;

  constructor(messages: Record<string, string>) {
    this.messages = Object.freeze({ ...messages });
    Object.freeze(this);
  }

  static from(data: unknown): FieldErrors {
    if (!data || typeof data !== 'object') return FieldErrors.none;
    const messages = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string'));
    return Object.keys(messages).length ? new FieldErrors(messages) : FieldErrors.none;
  }

  get isEmpty(): boolean {
    return this.fields.length === 0;
  }

  get fields(): string[] {
    return Object.keys(this.messages);
  }

  has(field: string): boolean {
    return field in this.messages;
  }

  get(field: string): string | undefined {
    return this.messages[field];
  }

  /** These errors minus the named fields, e.g. once the user has changed them. */
  without(fields: Iterable<string>): FieldErrors {
    const remaining = { ...this.messages };
    for (const field of fields) delete remaining[field];
    return Object.keys(remaining).length === this.fields.length ? this : new FieldErrors(remaining);
  }
}
