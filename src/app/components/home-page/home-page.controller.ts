import { Controller } from '../../../framework/index.ts';
import type { ApplicationDomain } from '../../application/application-domain.ts';
import type { ServerRequests } from '../../application/server/server-requests.ts';
import { routes } from '../../routes.ts';
import type { HomePageModel } from './home-page.model.ts';

export class HomePageController extends Controller<HomePageModel, ApplicationDomain> {
  #requests!: ServerRequests;

  protected createModel(): HomePageModel {
    return {
      title: 'Your SPA library is overrated.',
      scenarios: [
        { name: 'Domain-held state', stretches: 'The counter’s count lives in the application domain; the model is only an interface', href: routes.href('home'), tryIt: 'Use the counter below' },
        { name: 'Runtime child components', stretches: 'syncChildren(): a row component per todo', href: routes.href('todos'), tryIt: 'Switch filters and search' },
        { name: 'Keyboard and focus', stretches: 'keys(), focus(), field(); renaming in place is domain state', href: routes.href('todos'), tryIt: 'Double-click a title; Enter saves, Escape cancels' },
        { name: 'Value and previous value', stretches: 'field() hands { name, value, previous }; the domain records the last change', href: routes.href('todo', { id: 2 }), tryIt: 'Change any field and watch “Last change”' },
        { name: 'Search in the URL', stretches: 'The domain owns filter and search, kept in the URL with replace history', href: routes.href('todos', {}, { q: 'buy' }), tryIt: 'Type, reload, go back' },
        { name: 'Edit session', stretches: 'The domain holds the edit; the controller maps it to a form with fill() and formValues()', href: routes.href('todo', { id: 2 }), tryIt: 'Edit every field type' },
        { name: 'Server validation', stretches: 'Per-field errors from a 422, kept on the edit session', href: routes.href('todo', { id: 2 }), tryIt: 'Reuse another todo’s title, then Save' },
        { name: 'Asking first', stretches: 'The domain asks; the dialog shows ConfirmationAsked and answers through Questions', href: routes.href('todos'), tryIt: 'Delete a todo' },
        { name: 'Unsaved work', stretches: 'The domain guards drafts and edits on every navigation, back and forward too', href: routes.href('todo', { id: 2 }), tryIt: 'Change a field, then click Home or Back' },
        { name: 'Missing records', stretches: 'Route params plus a 404 from the server', href: routes.href('todo', { id: 999 }), tryIt: 'Open todo 999' },
        { name: 'Failure and retry', stretches: 'Notices and retries are domain state; the toast shows NoticeRaised', href: routes.href('todos'), tryIt: 'Press “Fail the next request”, then toggle a todo' },
        { name: 'Redirects and 404 pages', stretches: 'Route redirects and the fallback route', href: '/home', tryIt: '/home redirects here; /nowhere is not found' },
      ],
    };
  }

  protected override onCreate(): void {
    this.#requests = this.domain.requests;
  }

  protected override onInterconnect(): void {
    this.handle('failNextRequest', this.#failNextRequest);
  }

  #failNextRequest(): void {
    this.#requests.failNext();
  }
}
