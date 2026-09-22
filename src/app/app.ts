import { Application, type Component, type IRouteTable } from '../framework/index.ts';
import { ApplicationDomain } from './application/application-domain.ts';
import { ShellComponent } from './components/shell/shell.component.ts';
import { routes } from './routes.ts';

export class TodoApplication extends Application<ApplicationDomain> {
  protected createDomain(): ApplicationDomain {
    return new ApplicationDomain();
  }

  protected createShell(): Component {
    return new ShellComponent('shell');
  }

  protected override createRoutes(): IRouteTable {
    return routes;
  }
}
