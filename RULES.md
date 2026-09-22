<!-- Generated from architecture/rules.mjs. Do not edit: change the rule, then `npm run rules:md`. -->
# The rules

These 16 rules are what make a vanilla-mvc application what it is. They are not advice:
`vanilla-mvc/architecture` checks every one of them over your source, on the syntax tree.

### 1. Import only the framework package and your own source.

Anything else is a dependency the architecture never agreed to. The framework has no runtime dependencies so an application can have few too.

Wrong:
```ts
import { chunk } from 'lodash';
```
Right:
```ts
import { Controller } from 'vanilla-mvc';
```

<sub>rule `imports` · every import lands under vanilla-mvc, src/</sub>

### 2. Reach the router, fields and templates libraries through the framework's seams, never directly. Style and template files may import vanilla-mvc/css.

The seams are what let a library be swapped. A component that imports RouteTable has welded itself to one router.

Wrong:
```ts
import { RouteTable } from 'vanilla-mvc/router';   // in a controller
```
Right:
```ts
this.navigate(routes.href('home'));
```

<sub>rule `libraries` · the app reaches libraries only through the framework</sub>

### 3. Take `css`, `Style` and `styled` from 'vanilla-mvc'. The css library lends engines (layout, theme…), not its tag.

The framework's css tag goes through the styling seam, which owns the sheet. The library's raw tag bypasses it.

Wrong:
```ts
import { css } from 'vanilla-mvc/css';
```
Right:
```ts
import { css, Style } from 'vanilla-mvc';
import { layout } from 'vanilla-mvc/css';
```

<sub>rule `cssTag` · css and styled come from the framework, never from a library</sub>

### 4. Only a controller imports from application/. Models, templates and styles see only their own component.

The controller is the one place presentation meets the application. A template that reaches the domain has two masters.

Wrong:
```ts
import type { Counter } from '../../application/counter.ts';   // in home.model.ts
```
Right:
```ts
// home.controller.ts
import type { ApplicationDomain } from '../../application/application-domain.ts';
```

<sub>rule `modelsReach` · component models, templates and styles never reach the application; only controllers do</sub>

### 5. An event file imports only other event files.

Events are the contract between the application and presentation. A contract that imports one side belongs to it.

Wrong:
```ts
import type { Counter } from '../application/counter.ts';   // in an event
```
Right:
```ts
export interface TicksChanged {
  readonly type: 'TicksChanged';
  ticks: number;
}
```

<sub>rule `eventContract` · the event contract depends on neither side</sub>

### 6. Nothing under application/ imports from components/.

The application domain knows nothing about screens. It publishes facts; whoever cares maps them.

Wrong:
```ts
import type { HomeModel } from '../components/home/home.model.ts';   // in a capability
```
Right:
```ts
this.publish<TicksChanged>({ type: 'TicksChanged', ticks });
```

<sub>rule `presentation` · the application never reaches into presentation</sub>

### 7. A *.model.ts lives in its component folder and holds types only: interfaces, type aliases, type-only imports.

The model is what the view reads. The moment it holds behaviour, the view has somewhere to put logic.

Wrong:
```ts
export class HomeModel { ticks = 0; }
```
Right:
```ts
export interface HomeModel {
  ticks: number;
}
```

<sub>rule `modelShape` · models belong to components, and a model is only an interface</sub>

### 8. One event per file under events/, exported as an interface or a type — never a class.

An event is plain frozen data on the bus. A class invites methods, and a second event in the file hides from the one looking for it.

Wrong:
```ts
export class TicksChanged { … }
```
Right:
```ts
export interface TicksChanged {
  readonly type: 'TicksChanged';
  ticks: number;
}
```

<sub>rule `eventFiles` · every event type is in its own file, as an interface</sub>

### 9. An event interface's `type` is the string of its own name.

Subscribers key on the string. A mismatch compiles, and the subscriber never hears the event.

Wrong:
```ts
export interface TicksChanged { readonly type: 'TickChanged'; }
```
Right:
```ts
export interface TicksChanged { readonly type: 'TicksChanged'; }
```

<sub>rule `eventNames` · events name themselves: each event interface declares a literal type matching its name</sub>

### 10. Register every handler as a private method — this.handle(name, this.#method), this.subscribe(type, this.#method) — and give a controller no public member of its own.

A controller is driven by gestures and facts, not by callers. A public method is an invitation to call it from somewhere the change engine cannot see.

Wrong:
```ts
save(): void { … }
this.subscribe('X', (e) => this.#x(e));
```
Right:
```ts
protected override onInterconnect(): void {
  this.handle('save', this.#save);
  this.subscribe<Saved>('Saved', this.#saved);
}
```

<sub>rule `controllers` · controllers: subscriptions and DOM handlers go to private methods; nothing public of their own</sub>

### 11. Whatever writes the model — the handler, or any method it calls — must reach this.changed().

There is no change detection. A write nobody states is never drawn.

Wrong:
```ts
#ticksChanged({ ticks }: TicksChanged): void {
  this.model.ticks = ticks;
}
```
Right:
```ts
#ticksChanged({ ticks }: TicksChanged): void {
  this.model.ticks = ticks;
  this.changed();
}
```

<sub>rule `stated` · a change to the model is stated, however deep the call goes</sub>

### 12. A promise a controller starts is returned, awaited, or handed to this.own().

A DOM event is one synchronous stack. A promise leaves it, and whatever it publishes when it settles has no gesture to end — so nothing draws it unless its starter owns it.

Wrong:
```ts
#reload(): void {
  this.#store.load();
}
```
Right:
```ts
#reload(): Promise<void> {
  return this.#store.load();
}
```

<sub>rule `handedBack` · a handler that starts server work hands it back, so the gesture can close the loop</sub>

### 13. Write the css tag inside the Style callback, never at the top of a module.

The tag goes through the styling adapter, which Application.create() installs. At import there is none, and the whole application fails to boot with 'No adapters installed.'

Wrong:
```ts
const card = css`:scope { padding: 1rem; }`;
```
Right:
```ts
export const cardStyle = new Style<CardModel>(() => css`:scope { padding: 1rem; }`);
```

<sub>rule `moduleScope` · nothing at module scope in a style or a template reaches the css tag</sub>

### 14. A DOM handler calls the application domain and writes nothing. The model changes when the fact comes back.

If the click writes the model, the domain never hears of it — and the next screen that cares has no fact to hear.

Wrong:
```ts
#tick(): void {
  this.model.ticks += 1;
  this.changed();
}
```
Right:
```ts
#tick(): void {
  this.domain.counter.increment();   // publishes TicksChanged
}
```

<sub>rule `gestures` · DOM handlers change nothing themselves: gestures go to the application domain</sub>

### 15. Add a child with this.adopt(capability), never this.children.push(capability).

push() alone compiles and runs until the child publishes. Then it fails somewhere else as 'not attached to an application', because the bus is found through parent.

Wrong:
```ts
this.children.push(new Counter());
```
Right:
```ts
this.counter = this.adopt(new Counter());
```

<sub>rule `adopted` · a capability is adopted, never pushed: a child without a parent has no bus</sub>

### 16. A controller never calls changes.update(). It states changes; the gesture ends the pass.

One gesture, one render. A controller that renders mid-gesture draws a half-updated screen, and draws it twice.

Wrong:
```ts
this.changed();
changes.update();
```
Right:
```ts
this.changed();
```

<sub>rule `renderPass` · a render pass begins only at the end of a DOM event</sub>
