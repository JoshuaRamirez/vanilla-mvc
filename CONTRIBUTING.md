# Contributing

Thank you for looking. Bug reports, questions and pull requests are all welcome.

## Set up

```sh
git clone https://github.com/JoshuaRamirez/VanillaMVC.git && cd VanillaMVC
npm install
npm test
```

Node 22 or later. The browser tests need Chrome or Chromium; the harness finds it on macOS, Linux
and Windows, or set `CHROME=/path/to/chrome`. Without one those tests skip and say so.

`npm start` serves the demo in `src/app/` on http://localhost:4400, and the libraries' in-browser
tests at http://localhost:4400/test/browser/index.html.

## What a change needs

- **Tests.** A fix comes with the test that would have caught it. `npm test` is green.
- **The rules held.** `test/seams.test.mjs` checks the architecture of the framework itself; the
  five rules easiest to break are in [AGENTS.md](AGENTS.md).
- **A rule change** (in `architecture/rules.mjs`) adds an example to
  `test/architecture-examples.test.mjs` that turns exactly that rule red, then `npm run rules:md`.
- **A reason.** If the change is a decision a reader would otherwise have to guess at, add a record
  to [docs/decisions/](docs/decisions/).
- **A changelog line** under *Unreleased* in [CHANGELOG.md](CHANGELOG.md) if users would notice it.

Commits read `✨ feat(scope): what`, `🐛 fix(scope): what`, with a body saying why.

## Before proposing something large

Open an issue first. The framework's value is what it leaves out — no virtual DOM, no detection, no
dependencies — so a feature that adds machinery is usually answered by a smaller change somewhere
else. It is easier to find that together before the code exists.

## Checking against an application

The framework was developed against a real application, and the architecture rules are best tested
against one. If you have an application built on it:

```sh
CONSUMER=../my-app npm run test:consumer
```

## Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/),
version 2.1 — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Releasing (maintainers)

The package is not on npm — that name is an unrelated package — so a release is a tag:

```sh
npm version <patch|minor|major>   # move CHANGELOG's Unreleased under the new version first
git push --follow-tags
```

Applications install from GitHub, and `prepare` builds the package on install.

To try a release in an application before publishing it, publish to a local registry such as
Verdaccio with `npm publish --registry http://localhost:4873`, and give the application
`npx vanilla-mvc init --registry http://localhost:4873`.
