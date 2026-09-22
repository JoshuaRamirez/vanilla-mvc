# Working on vanilla-mvc

This file is for whoever changes the framework itself — a person, or an agent. Using the framework
in an application is a different job; the guide for that is generated into each application by
`npx vanilla-mvc init` (`architecture/guide.mjs`).

## What this is

A single-page-application framework with no runtime dependencies: an application tree built by
**create → interconnect → activate**, an event bus, templates rendered in place, and change that is
**stated** (`this.changed()`), never detected. Four libraries sit behind seams the framework owns.

| Path | What |
|---|---|
| `src/framework/` | the framework; `seams.ts` is the interface to each library |
| `src/framework/adapters/` | one adapter per library — the only code that imports a library |
| `src/libraries/{templates,fields,router,css}/` | the libraries; each imports only from itself |
| `src/app/` | a small demo application the seam rules are also checked against |
| `architecture/` | the rules an application is held to, on TypeScript's syntax tree, and the prose generated from them |
| `bin/vanilla-mvc.mjs` | the CLI: init, add, rules, guide, check, vendor, theme-css |
| `testing/` | the Chrome-over-CDP driver and `serve()`; shipped as `vanilla-mvc/testing` |
| `docs/decisions/` | why the code is shaped as it is, one record per decision |
| `docs/research/` | why each library was built rather than borrowed |

## Before you say it is done

```sh
npm test            # build, type-check, and every test; browser tests need Chrome
npm run rules:md    # after changing a rule in architecture/rules.mjs — RULES.md is generated
```

Commits are Conventional Commits with a gitmoji: `✨ feat(scope): …`, `🐛 fix(scope): …`. The body
says why, not what.

## Rules that are easy to break here

- **A library never imports the framework, or another library.** The adapter is the only bridge.
  `test/seams.test.mjs` enforces it.
- **The framework has no runtime dependencies.** A test fails if `dependencies` is non-empty.
  Development tooling goes in `devDependencies`, or an optional peer (as `typescript5` is).
- **A rule change is three changes:** the record in `architecture/rules.mjs`, an example in
  `test/architecture-examples.test.mjs` that turns exactly it red, and `npm run rules:md`.
- **Nothing is detected.** Do not add change detection, proxies or diffing to "help". The whole
  design rests on stating change; read `docs/decisions/a-change-is-stated-never-detected.md` first.
- **Prose has one home.** A fact written in two places becomes two facts that disagree. Link.
