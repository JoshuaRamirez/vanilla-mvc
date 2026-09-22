# A journey drives the UI through gestures only

A journey test clicks, types and presses. It never publishes on
`window.app.bus`, and never reaches into the domain to set state.

## The rule

A journey that needs another front's capability uses **that capability's
screen**. Needing a workspace with unsaved work means opening the editor and
typing in it, not publishing a `DraftChanged`.

The one sanctioned use of `window.app` is arming a failure —
`window.app.domain.requests.failNext()` — because there is no gesture for "the
network is about to break", and because it proves the rule rather than dodging
it: the arming is not drawn until the next real click. See
[a-change-is-stated-never-detected](a-change-is-stated-never-detected.md).

## Why

A journey that sets up state through the bus tests the bus. The screens it
skipped can rot completely and it stays green. Every shortcut is coverage
quietly deleted.

It is also how two real framework defects were found: a modal losing its `open`
attribute to the morph, and the router not rendering after a cancelled
navigation. Neither is reachable except by doing what a user does.
