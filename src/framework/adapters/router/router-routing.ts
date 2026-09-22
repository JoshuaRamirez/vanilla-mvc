import { HistoryRouter, RouteTable } from '../../../libraries/router/index.ts';
import type { INavigator, IRouteTable, IRouting, NavigatorOptions, Route, RouteTableOptions } from '../../seams.ts';

/** IRouting on libraries/router: path matching plus History API navigation. */
export class RouterRouting implements IRouting {
  createTable(routes: readonly Route[], options?: RouteTableOptions): IRouteTable {
    return new RouteTable(routes, options);
  }

  createNavigator({ table, onNavigating, onChanged }: NavigatorOptions): INavigator {
    return new HistoryRouter({ table, onNavigating, onChanged });
  }
}
