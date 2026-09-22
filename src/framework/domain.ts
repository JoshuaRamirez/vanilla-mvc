let established: object | null = null;

/** Make the application domain root available to every controller. Application.create() does this. */
export function establishDomain(domain: object): void {
  established = domain;
}

/** The application domain root. Controllers get it through their base class. */
export function establishedDomain<TDomain extends object = object>(): TDomain {
  if (!established) throw new Error('No application domain established. Application.create() establishes it before creating components.');
  return established as TDomain;
}
