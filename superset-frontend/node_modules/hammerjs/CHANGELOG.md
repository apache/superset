# Changelog

### 2.0.6, 2015-12-23
- Add Assign method and deprecate merge and extend ([#895](https://github.com/hammerjs/hammer.js/pull/895)[fc01eae](https://github.com/hammerjs/hammer.js/commit/fc01eaea678acc430c664eb374555fbe3d403bdd))
- Expose Hammer on window or self if either is defined to avoid issues when AMD is present but not used. ( [356f795](https://github.com/hammerjs/hammer.js/commit/356f7955b01f3679c29d6c45931679256b45036e))
- Add support for PointerEvent instead of MSPointerEvent if supported. ([#754](https://github.com/hammerjs/hammer.js/issues/754), [439c7a6](https://github.com/hammerjs/hammer.js/commit/439c7a6c46978ab387b4b8289399e904d1c49535))
- Fixed moz-prefix, prefix should be Moz not moz. ([3ea47f3](https://github.com/hammerjs/hammer.js/commit/3ea47f3aebadc9d3bb6bf52bc8402cad135ef8a9))
- Removed non-existant recognizer ([f1c2d3b](https://github.com/hammerjs/hammer.js/commit/f1c2d3bf05f530ae092ecfc2335fceeff0e9eec9))
- Fixed config leaking between instances([189098f](https://github.com/hammerjs/hammer.js/commit/189098ff7736f6ed2fce9a3d3e1f5a3afee085ba))
- Fixed gaps in gesture configs and update tests to match ([70c2902](https://github.com/hammerjs/hammer.js/commit/70c2902d773a750e92ce8c423f8a4165c07eab97))
- Fixed Manager off method ([#768](https://github.com/hammerjs/hammer.js/issues/768), [da49a27](https://github.com/hammerjs/hammer.js/commit/da49a2730779ecc3b4dd147cc418a0df7c70fad9))
- Added compatibility with requirejs optimizer namespaces ( [70075f2](https://github.com/hammerjs/hammer.js/commit/70075f2df1b855f7c6d8d3caac49b9276b88c8d6))
- Made touchaction test zoomable ( [50264a7](https://github.com/hammerjs/hammer.js/commit/50264a70251ca88bbaf7b666401e527eee616de5))
- Fixed preventing default when for `pan-x pan-y` case ( [95eaafa](https://github.com/hammerjs/hammer.js/commit/95eaafadad27bd1b25d20cf976811a451922f1c4))
- Fixed incorrect touch action pan direction ( [a81da57](https://github.com/hammerjs/hammer.js/commit/a81da57a82ebf37e695e7c443e4e2715e7f32856))
- Fixed combined pan-x pan-y to resolve to none ( [fdae07b](https://github.com/hammerjs/hammer.js/commit/fdae07bc2ba3c90aad28da6791b3d5df627bc612))
- Fixed inverted touch-action for pan recognizer ([#728](https://github.com/hammerjs/hammer.js/issues/728), [605bd3b](https://github.com/hammerjs/hammer.js/commit/605bd3beca780be91dd43f9da8b809d155a43d1a))
- Fixed dependency on non standard touch list ordering ([#610](https://github.com/hammerjs/hammer.js/issues/610), [#791](https://github.com/hammerjs/hammer.js/issues/791), [287720a](https://github.com/hammerjs/hammer.js/commit/287720a6e5067e7f28be8b8b3b266d22905361c4))
- Fixed swipe to not trigger after multitouch gesture ([#640](https://github.com/hammerjs/hammer.js/issues/640), [711d8a1](https://github.com/hammerjs/hammer.js/commit/711d8a1df1aa5057ecb536454a36257e3c0d6d91))
- Fixed swipe recognizer to use overall gesture direction and velocity ( [963fe69](https://github.com/hammerjs/hammer.js/commit/963fe697515273fee508414bc29e2656465cea55))
- Fixed getDirection returning reversed direction ( [e40dcde](https://github.com/hammerjs/hammer.js/commit/e40dcde43bdac7a74c8ce5c05a4f62121089cd91))
- Fixed detection of tap when multi touch gestures are present ( [c46cbba](https://github.com/hammerjs/hammer.js/commit/c46cbba1c2cbbf874b59913416858d9dae297e64))
- Fixed incorrect event order ([#824](https://github.com/hammerjs/hammer.js/issues/824), [92f2d76](https://github.com/hammerjs/hammer.js/commit/92f2d76188480d967e738a19cd508d0b94a31329))
- Fixed leaking options between recognizer instances ([#813](https://github.com/hammerjs/hammer.js/issues/813), [af32c9b](https://github.com/hammerjs/hammer.js/commit/af32c9bace3f04bb34bee852ff56a33cc8fc27cd))
- Fixed detection when element has no style attribute ( [5ca6d8c](https://github.com/hammerjs/hammer.js/commit/5ca6d8cbead02c71929a8073e95ddf98e11c0e06))

### 2.0.4, 2014-09-28
- Fix IE pointer issue. [#665](https://github.com/hammerjs/hammer.js/pull/665)
- Fix multi-touch at different elements. [#668](https://github.com/hammerjs/hammer.js/pull/668)
- Added experimental [single-user Touch input handler](src/input/singletouch.js). This to improve performance/ux when only a single user has to be supported. Plans are to release 2.1 with this as default, and a settings to enable the multi-user handler.

### 2.0.3, 2014-09-10
- Manager.set improvements. 
- Fix requireFailure() call in Manager.options.recognizers. 
- Make DIRECTION_ALL for pan and swipe gestures less blocking.
- Fix Swipe recognizer threshold option.
- Expose the Input classes.
- Added the option `inputClass` to set the used input handler.

### 2.0.2, 2014-07-26
- Improved mouse and pointer-events input, now able to move outside the window.
- Added the export name (`Hammer`) as an argument to the wrapper.
- Add the option *experimental* `inputTarget` to change the element that receives the events.
- Improved performance when only one touch being active.
- Fixed the jumping deltaXY bug when going from single to multi-touch.
- Improved velocity calculations.

### 2.0.1, 2014-07-15
- Fix issue when no document.body is available
- Added pressup event for the press recognizer
- Removed alternative for Object.create

### 2.0.0, 2014-07-11
- Full rewrite of the library.
