1.3.0 / 2019-12-14
=================
  * [New] add `auto` entry point
  * [Refactor] use `callBind` helper from `es-abstract`
  * [Deps] update `define-properties`
  * [meta] add `funding` field
  * [Dev Deps] update `eslint`, `@ljharb/eslint-config`, `covert`, `has`, `tape`
  * [Tests] use shared travis-ci configs
  * [Tests] use `eclint` instead of `editorconfig-tools`
  * [Tests] remove `jscs`
  * [Tests] use `npx aud` instead of `nsp` or `npm audit` with hoops
  * [actions] add automatic rebasing / merge commit blocking

1.2.0 / 2017-10-24
=================
  * [New] add support for `dotAll` regex flag.
  * [Deps] update `define-properties`
  * [Dev Deps] update `eslint`, `@ljharb/eslint-config`, `tape`, `jscs`, `nsp`, `@es-shims/api`
  * [Tests] use pretest/posttest for better organization
  * [Tests] up to `node` `v8.8`, `v7.10`, `v6.11`, `v4.8`; improve matrix; use `nvm install-latest-npm` so new npm doesn’t break old node

1.1.1 / 2015-08-16
=================
  * [Fix] cover the case where there is no descriptor on the prototype

1.1.0 / 2015-08-16
=================
  * [Robustness] Make some things a bit more robust against later modification of the environment
  * [New] Implement the [es-shim API](es-shims/api)
  * [Refactor] Move implementation to `implementation.js`
  * [Dev Deps] update `eslint`, `jscs`, `tape`, `nsp`, `covert`
  * [Tests] up to `io.js` `v3.0`
  * [Tests] use my personal shared `eslint` config
  * [Docs] Switch from vb.teelaun.ch to versionbadg.es for the npm version badge SVG

1.0.1 / 2014-12-13
=================
  * Ensure that non-object values throw, per spec (#3)
  * Properly match spec steps, so that the flags getter is generic (#3)

1.0.0 / 2014-12-10
=================
  * v1.0.0

