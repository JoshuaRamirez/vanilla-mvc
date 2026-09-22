import { ApplicationElement } from '../../framework/index.ts';
import { Notices } from './communication/notices.ts';
import { Questions } from './communication/questions.ts';
import { TodoEditing } from './editing/todo-editing.ts';
import { ServerRequests } from './server/server-requests.ts';
import { TodoApi } from './server/todo-api.ts';
import { Tally } from './tally/tally.ts';
import { TodoBrowsing } from './todos/todo-browsing.ts';
import { TodoCollection } from './todos/todo-collection.ts';
import { TodoDraft } from './todos/todo-draft.ts';
import { UnsavedWork } from './work/unsaved-work.ts';

/**
 * The application domain: its capabilities, composed. It holds nothing
 * itself. All state changes go through these capabilities; controllers call
 * their methods, and hear back through events their publishers put on the bus.
 */
export class ApplicationDomain extends ApplicationElement {
  api!: TodoApi;
  notices!: Notices;
  questions!: Questions;
  requests!: ServerRequests;
  collection!: TodoCollection;
  browsing!: TodoBrowsing;
  draft!: TodoDraft;
  editing!: TodoEditing;
  unsavedWork!: UnsavedWork;
  tally!: Tally;

  protected override onCreate(): void {
    this.api = new TodoApi();
    this.notices = this.adopt(new Notices());
    this.questions = this.adopt(new Questions());
    this.requests = this.adopt(new ServerRequests(this.api, this.notices));
    this.collection = this.adopt(new TodoCollection(this.api, this.requests, this.questions));
    this.browsing = this.adopt(new TodoBrowsing(this.collection));
    this.draft = this.adopt(new TodoDraft(this.collection));
    this.editing = this.adopt(new TodoEditing(this.api, this.requests, this.collection, this.notices));
    this.unsavedWork = this.adopt(new UnsavedWork(this.questions));
    this.tally = this.adopt(new Tally());
  }
}
