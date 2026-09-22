# Changelog

What changed for someone using vanilla-mvc. While the version starts with 0, a minor release may
break things; each one below says what, and what to do.

## Unreleased

- **Public, on GitHub.** Install with `npm install github:JoshuaRamirez/vanilla-mvc`; the package
  builds itself on install. It is not on npm: that name belongs to an unrelated package.
- **Public release preparation.** MIT licence; nothing in the package assumes a particular machine.
  `init` writes an `.npmrc` only when given `--registry <url>`.
- The test harness finds Chrome or Chromium on Linux and Windows as well as macOS, and runs it
  unsandboxed on Linux CI, where the sandbox is unavailable.

## 0.7.0

- `vanilla-mvc check [file…]` judges files against the architecture rules; `--hook` reads a Claude
  Code `PostToolUse` payload and hands a broken rule back to the agent that made the edit.
- `init` wires that hook into `.claude/settings.json`.

## 0.6.0

- **The architecture rules read TypeScript's syntax tree instead of source text.** They were wrong
  on 12 of 41 known cases, both ways. **Breaking:** they now see more — `async` methods as waits,
  public fields and accessors on a controller, dynamic `import()`, writes deeper in the model — so
  an application may find new violations, and its `atLeast` floors may need raising.
- `vanilla-mvc/architecture` needs the optional peer `typescript5`
  (`npm i -D typescript5@npm:typescript@~5.9.3`).
- `vanilla-mvc add component|event|capability <name>` writes the files in the shape the rules check.
- `vanilla-mvc rules` prints every rule with a wrong and a right example; `vanilla-mvc guide` writes
  `AGENTS.md`, the guide an agent reads first. `init` writes both it and `test/architecture.test.mjs`.

## 0.5.0

- **Breaking:** an event position bound to a function no controller registered —
  `@click=${() => c.save()}` — throws when the template is built. Register it with
  `this.handle('save', this.#save)` and bind `@click=${c.handler('save')}`.

## 0.4.0

- `ApplicationElement.adopt(child)` sets the parent and adds the child. A new rule refuses
  `this.children.push(…)` in an application, which leaves the child without a bus.
- The architecture rules see compound assignment (`+=`) and `subscribe<T>(…)`, which they missed.

## 0.3.0

- The architecture rules ship as `vanilla-mvc/architecture`, so an application can run them over
  its own source.

## 0.2.0

- The CLI: `vanilla-mvc init`, `vendor` and `theme-css`.
- `changed()` warns when a change is stated and nothing draws it.

## 0.1.0

- The framework as a package: `vanilla-mvc`, `/css`, `/fields`, `/router`, `/templates`, `/testing`.
