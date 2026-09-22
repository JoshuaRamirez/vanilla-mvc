/** Inside the domain: a capability's unsaved work, and where it would be lost. scope 'route' is lost by leaving the route; 'url' by any change of URL on it. */
export interface WorkAtRisk {
  readonly type: 'WorkAtRisk';
  readonly key: string;
  readonly route: string;
  readonly scope: 'route' | 'url';
  readonly atRisk: boolean;
}
