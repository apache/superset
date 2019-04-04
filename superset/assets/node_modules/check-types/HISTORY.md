# History

## 7.4.0

### New features

* docs: add note about typescript definitions to readme (13c7a90)

### Bug fixes

* docs: remove errant semicolon from example code (9053f95)
* docs: clarify the behaviour of between and inRange (88a2f61)
* tests: ensure tests run in non-es6 environments (4bae637)

### Other changes

* deps: update please-release-me (72377bf)
* project: migrate to gitlab (19919b5)
* package: update authors (9848df0)

## 7.3.0

* feature: add primitive predicate (3114d7f)

## 7.2.1

* fix: perf tweaks for tight loops (8a9919d)
* chore: update ci config (136f185)

## 7.2.0

* feature: return the target value from assertions (73da792)
* chore: add release script dependency (cacc348)
* fix: make assert throw for any falsy value (4f15c73)

## 7.1

* Implement `nonEmptyObject`. Thanks to [Victor Bakke][gipphe].
* Implement `nonEmptyArray`. Thanks to [Victor Bakke][gipphe].
* Fix error messages on assertions that take a string as their last argument.
* Add support for custom error types in assertions.
* Throw TypeErrors by default.

## 7.0

* Breaking changes:
  * Rename `instance` to `instanceStrict`.
  * Combine `builtIn` and `userDefined` to form new `instance` predicate.
* Exclude non-src files from npm package

## 6.0

* Breaking change:
  * `either` modifier removed.
* Eliminated some string duplication.

## 5.1

* Fix broken implementation of `maybe.array.of`.

## 5.0

* Breaking changes:
  * `isMap` predicate removed (see `builtIn`).
  * `error` predicate removed (see `builtIn`).
* Implement `builtIn` predicate.
* Implement `userDefined` predicate.
* Implement `emptyString` predicate.
* Implement `infinity` predicate.

## 4.3

* Implement `isMap`. Thanks to [Ryan Temple][ryantemple].

## 4.2

* Implement `includes`.

## 4.1

* Implement `equal`.

## 4.0

* Breaking changes:
  * Rename `unemptyString` => `nonEmptyString`.
  * Support derived error objects in `error`.
* Fix HTMLElement instance predicate bug in Safari.

## 3.3

* Implement `greaterOrEqual`.
* Implement `lessOrEqual`.
* Implement `inRange`.
* Fix default error message for `function`. Thanks to [Paul Jolly][myitcv].

## 3.2

* Implement `arrayLike`
* Implement `iterable`
* Implement `array.of`
* Implement `arrayLike.of`
* Implement `iterable.of`
* Implement `object.of`
* Fix unhandled exception when dereferencing undefined data inside `map`.

## 3.1

* Accept a single predicate in `map`.
* Remove assertions from `hasLength` and `like`.

## 3.0

* Breaking changes:
  * Rename `length` => `hasLength`.
  * Drop `webUrl`. (sorry @bahmutov!)
* Turn `assert`, `not` and `maybe` into standalone functions as well as modifiers.
* Implement `match` for general regex-matching. Possibly of interest to former users of `webUrl`, `gitUrl` and `email`.
* Implement `contains`.
* Implement `between`.
* Implement `greater`.
* Implement `less`.
* Implement `zero`.
* Implement `emptyArray`.
* Implement `error`.
* Fix errant check that property counts match in `map`.

## 2.2

* Ensure `date` predicate returns `false` for invalid dates.

## 2.1

* Add `either`.

## 2.0

* Breaking changes:
  * Drop ES3 support.
  * Rename `verify` => `assert`.
  * Remame `nulled` => `null`.
  * Switch `defined` to `undefined` for consistency with `null`.
  * Tightened implementation of `webUrl` to reject more cases.
  * Drop `gitUrl`. (sorry @galniv!)
  * Drop `email`. (sorry @rodrigo!)
  * Drop `floatNumber`. (sorry @rodrigo!)
  * Rename `oddNumber`, `evenNumber`, `positiveNumber`, `negativeNumber`, `intNumber` => `odd`, `even`, `positive`, `negative`, `integer`.
  * Rename `bool` => `boolean`.
  * Rename `every` => `all`.
* Add predicate `assigned`.
* Add `apply` batch operation.
* Delete superfluous unit tests.

## 1.4

* Implement `bool` predicate. Thanks to [Clinton Skakun][clintonskakun].

## 1.3

* Implement `email`, `intNumber` and `floatNumber` predicates. Thanks to [Rodrigo González][rodrigo].
* Infinity is not a number.
* Implement `defined` and `nulled`. Thanks to [Alejandro Villanueva][ialex].
* Speculatively fix conflict with angular-mocks.

## 1.2

* Implement `not` modifier.
* Implement `gitUrl` predicate. Thanks to [Gal Niv][galniv].

## 1.1

* Replace `check.maybe.verify.xxx` with `check.verify.maybe.xxx`.

## 1.0

* API overhaul:
    * Predicates exported as `check.xxx` rather than `check.isXxx`.
    * Verifiers exported as `check.verify.xxx` rather than `check.verifyXxx`. Thanks to [Marc-Olivier Ricard][marcolivier].
* Unit tests added for error messages.

## 0.8

* Added `isWebUrl` and `verifyWebUrl`. Thanks to [Gleb Bahmutov][gleb].

## 0.7

* Added `check.maybe` modifier. Thanks to [Marc-Olivier Ricard][marcolivier].
* Added `check.map`, `check.every` and `check.any` batch operations. Thanks to [Marc-Olivier Ricard][marcolivier].
* Harmonised the node and browser unit tests.

[marcolivier]: https://github.com/ricardmo
[gleb]: https://github.com/bahmutov
[galniv]: https://github.com/galniv
[rodrigo]: https://github.com/roro89
[ialex]: https://github.com/ialex
[clintonskakun]: https://github.com/clintonskakun
[myitcv]: https://github.com/myitcv
[ryantemple]: https://github.com/ryantemple
[gipphe]: https://github.com/Gipphe

