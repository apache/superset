CHANGELOG

v1.1.0-alpha.1 - Aug 1, 2018
- `sideEffects` flag added to `package.json` to improve tree-shaking performance
- `asciify-image` again a dependency (since it has cleaned up their dependencies).
- "browser" field in package.json used to ensure latest webpack doesn't bundle `asciify-image`.

v1.0.4 - Aug 3, 2018
- Add various node.js modules to package.json 'browser' field.

v1.0.3 - Aug 3, 2018
- Add `asciify-image: false` in package.json browser field`

v1.0.2
- Log.probe now only logs same string once, as intended
- Remove asciify-image dependency (to avoid recursive npm dep)

v1.0.1 - May 3, 2018
- Image logging improvements

v1.0.0 - Apr 16, 2018
- Initial official release

## Old Prereleases

v1.0.0-alpha.11
- `spy.returns` method added
- Server start retry logic to handle port in use case.

v1.0.0-alpha.10
- bundle size tests
- no longer use external assert

v1.0.0-alpha.9
- not stop server when failed

v1.0.0-alpha.8
- default log export
- `Log.probe` 
- `Stats` class improvements

v1.0.0-alpha.7
- probe timings

v1.0.0-alpha.6
- Experimental image utils
- new Stats class
- Browser automation BrowserTestDriver
- experimental image utils

v1.0.0-alpha.5
- fix console logging

v1.0.0-alpha.4
- Support saving probe config in local storage
- Doc improvements

v1.0.0-alpha.3
- Fix groupEnd issue under Node.js

v1.0.0-alpha.2
- Support functions that generate messages: log.log(() => `message ${message}`)
- Support `log.table`

v1.0.0-alpha.1
- Move to 1 series releases, to support use in luma.gl and deck.gl

v0.2.2
- Disable babel-preset-env temporarily as it requires upstream deps to follow

v0.2.1
- Remove dist-es6 completely

v0.2.0
- `NodeTestDriver` renamed to `BrowserDriver`
- Fixes to Log class
- Fixes to build scripts

v0.1.0
- Remove `bench` and `test` from main index.js, require separate imports.
- `Spy` renamed to `makeSpy`, final call.
- Improved test structure

v0.0.7
- Fix naming of test exports

v0.0.6
- Fix triple exports

v0.0.5
- Split into three exports (import 'probe.gl', import 'probe.gl/bench', import 'probe.gl/test')
- New `NodeTestDriver` class
- {color: ...} option for Node.js

v0.0.4
- Markdown report option
- Bench test case priorities
- FIX: Cap iteration count for long running test cases (regression)

v0.0.3
- Bench: Initial regression testing, local storage
- Log: Initial rewrite to return log functions, enabling source links

v0.0.2
- Async benchmarking, improved DOM logging

v0.0.1
- `Bench` and `Log` classes added.

v0.0.0
- probe.gl is now open source. We'll keep it in 0.x version for a while until the API is stable.
