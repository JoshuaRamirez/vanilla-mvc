# A change is stated, never detected

There is no change detection. A controller that changes its model calls
`this.changed()`, and the change engine renders once per turn.

## The rule

**A change stated outside a DOM event is never drawn.** The unit of work is a
DOM event: a click, a submit, a navigation, a server answer arriving on a
promise that a gesture started. Publishing on the bus from the console changes
the model and draws nothing until the next real event.

`README.md`'s rendering section is the one home of this rule. No other file
restates it.

## Why

Detecting changes means either proxying every model (and paying for every read)
or diffing every render (and paying for every tree). Stating them costs one call
at the site that already knows a change happened.

The cost is real and worth naming, and it is worse than it first looked. Forget
`changed()` and nothing draws: that one is loud, immediate and local, which is
the kind worth trading for.

The other way to get it wrong is not loud at all, and it is the one a newcomer
finds first.

## The silent one: a listener the framework never registered

`changed()` only registers. Something has to call `update()`, and only three
things do — a DOM handler registered with `handle()`, the router, and a promise
handed back through `own()`. So this:

```ts
html`<button @click=${() => c.save()}>Save</button>`
```

type-checks, renders, fires, writes the model and calls `changed()` — and the
screen does not move. Nothing throws and nothing logs. Worse than nothing
happening: the registration sits in the set until some unrelated gesture drains
it, so the value appears later, out of nowhere.

It is the obvious mistake, because it is what every other template library
teaches. The registered form is the only one that works:

```ts
protected override onInterconnect(): void { this.handle('save', this.#save); }
```
```ts
html`<button @click=${c.handler('save')}>Save</button>`
```

Making the bare listener work would mean draining after any listener, which is
change detection wearing a different hat — it would delete this ruling. So the
framework refuses it instead, at two depths.

When a template is built, the renderer adapter checks every event position: a
function that no controller registered — and no view helper built from one — is
a TypeError at the first render, naming the registered form. A registered
handler carries a mark (`src/framework/delivery.ts`), and `prevent`, `field`,
`formValues` and `keys` pass it through only when what they wrap has it. The
template library itself stays generic; the check is the framework's adapter.

That cannot see a change stated off any gesture at all — a subscription fired
from a timer, say. So `ChangeEngine` also looks again on the next macrotask and,
if a change is still undrawn, names the controller and the form that would have
worked.

Three things are not reports, each excluded on its own terms: startup, where
`Application.start()` draws the whole tree at the end; owned work, counted by
`changes.awaiting()` while it is in flight; and driving the engine directly, as
a unit test does, where `changes.warnOnUndrawn = false` says so. A test that
drives controllers without a DOM event should set it: every change such a test
states is undrawn by construction.

## What this means for tests

A journey drives the UI through gestures. It never publishes on `window.app.bus`
— not as a shortcut to set up state, not to skip a screen. See
[journeys-use-gestures-only](journeys-use-gestures-only.md).
