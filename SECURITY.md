# Security

## Supported versions

While the version starts with 0, only the latest release gets fixes.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub:
[**Report a vulnerability**](https://github.com/JoshuaRamirez/VanillaMVC/security/advisories/new)
(the repository's *Security* tab). Say what it affects, how to reproduce it, and what it lets an
attacker do.

You will get an answer within a week. A fix is released as soon as it is ready, and the advisory
credits you unless you ask otherwise.

## What is in scope

The framework and its libraries run in the browser and render what an application gives them. The
places that matter most:

- `src/libraries/templates` escapes every value placed in text or an attribute. A way to get markup
  or script through it is a vulnerability.
- `safeUrl()` (`src/framework/safe-url.ts`) turns `javascript:`, `data:` and other script-capable
  URLs into a blocked link. It is not applied for you: an `href` or `src` built from data should go
  through it. A URL that gets past it is a vulnerability.
- `bin/vanilla-mvc.mjs` and `testing/` run on a developer's machine and write files. A way to make
  them write outside the directory they were given is a vulnerability.
