# History

## 6.1.2

### Bug fixes

* eventify: escape object keys (910ad08)

### Other changes

* package: update deps (aafb4ff)

## 6.1.1

### Bug fixes

* eventify: don't serialise NaN or infinities (3c50fe4)

### Other changes

* deps: npm update (b3c86d0)
* project: add package lock file (63df27d)
* project: migrate to gitlab (26746a0)

## 6.1.0

### New features

* match: pass a depth argument to selector predicates (af15939)

### Other changes

* tests: delete unused var (f10902a)
* ci: reinstate tests in node 9 (7cd2594)
* ci: temporarily disable tests in node 9 (e27ccd0)

## 6.0.0

### Breaking changes

* eventify: distinguish between syntax and operational errors (e7bc23d)
* walk: distinguish between syntax and operational errors (419ddae)

### New features

* streams: expose a highWaterMark option (626f755)
* match: implement a streaming match api (e2e320d)

### Other changes

* docs: note the end of node-4 maintenance (0a32090)

## 5.3.1

### Bug fixes

* unpipe: prohibit unpipe from setting the ndjson option (90b61c6)

## 5.3.0

### New features

* walk: add support for NDJSON streams (e87672a)

### Bug fixes

* docs: document the pause and resume functions on event emitters (bfdf152)

### Other changes

* lint: silence warning (761bad4)
* package: update dev dependencies (396cc40)
* docs: link to bfj-collections (11eacb8)

## 5.2.1

### Bug fixes

* walk: handle stream errors sanely (9fe21ff)

### Other changes

* deps: update dev dependencies (c1d0518)
* ci: run tests in node 9 (222356e)
* deps: update dev dependencies (be54dbf)

## 5.2.0

* fix: extra paragraph about why bfj is slow (e51ca34)
* fix: expand possible causes of the error event (8d1d352)
* feature: add a pause method to the walk emitter (a4cd0e0)

## 5.1.1

* fix: replace old mockery link with proxyquire (e6b3924)
* chore: delete redundant teardowns (52040a6)
* fix: catch errors from user code (b8103e4)

## 5.1.0

* chore: remove extra trailing newlines (fa561e2)
* feature: allow callers to pass in the Promise constructor (aa5a664)
* refactor: better names for the option-mangling functions (5eb2e4e)

## 5.0.0

* fix: ditch mockery in favour of proxyquire (01a9177)
* breaking change: return bluebird promises instead of native (c80fe0f)
* fix: clear the yield counter when unpausing (9d5c95d)
* chore: reduce the buffer length (9abd435)

## 4.2.4

* chore: update deps (c3eeeb4)

## 4.2.3

* fix: eliminate costly string concatenation (42998d7)
* fix: micro-optimise eventify::proceed::after (98a2519)
* fix: micro-optimise walk::character (8d1c4cf)

## 4.2.2

* fix: silence obnoxious unhandled rejection warnings (1d4a902)

## 4.2.1

* refactor: discard chunks more aggressively (970a964)

## 4.2.0

* chore: add a unit test for parallel object references (e8f3895)
* chore: update check-types (c0bc551)
* fix: shortcut primitive coercion (c6381b5)
* fix: shortcut coercions (d9a9676)
* fix: eliminate unnecessary indirection in promise coercion (c63e81f)
* fix: yield rather than grow when buffer is filled (a3cc7e6)
* feature: add a bufferLength option (3b560f9)
* fix: document improved performance from disabling coercions (25eecc7)
* fix: fix lint errors (a85f7c0)

## 4.1.1

* fix: fix links in readme (90d7a0b)
* fix: pop references on exiting collections (c13eaf4)
* fix: eliminate sequential reference look-up (d622893)
* chore: add a couple of sentences on speed (ae8994d)

## 4.1.0

* fix: update node support in the readme (61c41f4)
* fix: reject if fs.createReadStream throws (4840938)
* fix: test on node 8 (371807b)
* feature: add a yieldRate option to the parsing functions (35bd20b)

## 4.0.1

* fix: set minimum required node version (db58b47)

## 4.0.0

* breaking change: revert to strings from circular arrays in walk (ccda677)
* feature: add yieldRate option to control events per tick (419247b)
* chore: increase the default discard threshold (751aa6c)

## 3.1.4

* fix: add options to example code (5c207dd)
* chore: update authors (cdf2b7d)
* chore: bump up the default array size to 4mb (4a2fe55)
* fix: fix stupid memory consumption bug (d2b6fe2)

## 3.1.3

* fix: eliminate needless per-character chunking in streamify (a7fcc2f)

## 3.1.2

* fix: eliminate duplicated readme section (283b3ce)

## 3.1.1

* fix: document the dropped support for node 4 (6120c9e)

## 3.1.0

* chore: tweak the readme (040e9be)
* chore: swap out bespoke circular array for hoopy (0ed7986)
* feature: used fixed-length circular array in streamify (e773a94)
* fix: eliminate mockery allowed module warning (b1dc7db)
* chore: fix lint errors (abde4de)

## 3.0.0

* chore: delete left-over debugging code (b903a27)
* chore: run tests on node 7 (acbb808)
* chore: remove old linter config (62c18ce)
* chore: update dependencies (882c74c)
* chore: add an integration test that parses a request (029afdb)
* chore: fix the broken perf test (8ac0e03)
* chore: add a crude memory-profiling script (1ee6f36)
* breaking change: preallocate memory to avoid out-of-memory conditions (18da753)
* feature: implement unpipe (f8a41d2)

## 2.1.2

* Fix lint errors.

## 2.1.1

* Fix "unhandled rejection" warnings.

## 2.1.0

* Stop throwing errors from promise-returning methods.

## 2.0.0

* Honour `toJSON` on all objects.
* Drop support for Node.js 0.12, switch to ES6.
* Tidy the readme.

## 1.2.2

* Sanely escape strings when serialising (thanks [@rowanmanning](https://github.com/rowanmanning)).

## 1.2.1

* Sanely handle `undefined`, functions and symbols.

## 1.2.0

* Sanely handle circular references in the data when serialising.

## 1.1.0

* Pass `options` to `fs.createReadStream` inside `read`.
* Fix truncated output bug in `write`.

## 1.0.0

* Breaking changes:
  * Take `Readable` parameter in `walk`.
  * Return `EventEmitter` from `walk`.
  * Return `Promise` from `write`.
* Fix stream termination bug in `streamify`.
* Fix missing comma after empty objects and arrays in `streamify`.
* Improve tests.
* Add `reviver` option for `parse` and `read`.
* Add `space` option for `streamify`, `stringify` and `write`.
* Remove the `debug` option from all functions.

## 0.2.0

* Implement `eventify`.
* Implement `streamify`.
* Implement `stringify`.
* Implement `write`.

## 0.1.0

* Initial release.

