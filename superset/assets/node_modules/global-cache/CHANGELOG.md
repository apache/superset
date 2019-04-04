1.2.1 / 2017-07-20
=================
  * [Fix] `set`: actually overwrite values
  * [Tests] up to `node` `v8.1`, `v7.10`, `v6.11`; npm < 5 breaks on node < 4; improve matrix
  * [Dev Deps] update `tape`, `jscs`, `nsp`, `eslint`, `@ljharb/eslint-config`, `semver`, `rimraf`
  * [Dev Deps] remove unused dep `parallelshell`

1.2.0 / 2016-04-06
=================
  * [New] add `setIfMissingThenGet`
  * [Tests] Add istanbul for code coverage and run it as part of tests.
  * [Tests] add tests for exceptions
  * [Tests] use pretest/posttest for linting/security; add `--silent`
  * [Tests] up to `node` `v5.10`, `v4.4`
  * [Dev Deps] update `jscs`, `eslint`, `@ljharb/eslint-config`, `nsp`

1.1.0 / 2016-01-29
=================
  * [New] add `#clear()` to clear the cache
  * [Dev Deps] update `tape`, `jscs`, `nsp`, `eslint`, `@ljharb/eslint-config`, `semver`
  * [Tests] up to `node` `v5.5`, don’t allow `0.8` to fail
  * [Tests] fix npm upgrades on older nodes

1.0.3 / 2015-10-19
=================
  * [Robustness] Ensure that when `Symbol` and `Symbol.for` are available, they're real Symbols and not gross fake ones
  * package.json: use object form of "authors", add "contributors"
  * [Dev Deps] update `jscs`, `eslint`, `@ljharb/eslint-config`

1.0.2 / 2015-10-14
=================
  * [Deps] update `define-properties`
  * [Dev Deps] update `tape`, `jscs`, `eslint`, `@ljharb/eslint-config`, `nsp`, `semver`
  * [Tests] up to `io.js` `v3.3`, `node` `v4.2`
  * [Docs] Switch from vb.teelaun.ch to versionbadg.es for the npm version badge SVG

1.0.1 / 2015-08-12
=================
  * [Fix] Use `Symbol.for` to ensure that multiple instances of `global-cache` on the page share the same cache.
  * [Tests] Test up to `io.js` `v3.0`
  * [Dev Deps] Update `jscs`, `tape`, `eslint`, `semver`, `define-properties`; use my personal shared `eslint` config

1.0.0 / 2015-07-01
=================
  * Initial release.
