# Changelog

## 3.0

### 3.0.8
* added support for `writing-mode` [#139](https://github.com/rofrischmann/inline-style-prefixer/issues/139) )

### 3.0.7
* fix `flexBasis` fallback for legacy IE 10 (`msPreferredSize` to `msFlexPreferredSize`) ( [#134](https://github.com/rofrischmann/inline-style-prefixer/issues/134) )

### 3.0.6
* fix legacy display prefixing for `inline-flex` ( [#132](https://github.com/rofrischmann/inline-style-prefixer/issues/132) )

### 3.0.5
* use Chrome data for Yandex browser ( [#127](https://github.com/rofrischmann/inline-style-prefixer/issues/127) )

### 3.0.4
* removed `caniuse-api` as a `devDependency`

### 3.0.3
* data update

### 3.0.2
* performance improvements (up to 30% faster)

### 3.0.1
* performance improvements (~10% faster) ( [#115](https://github.com/rofrischmann/inline-style-prefixer/pull/115) ) ( [#116](https://github.com/rofrischmann/inline-style-prefixer/pull/116) )
* ordering prefixed properties correctly ( [#117](https://github.com/rofrischmann/inline-style-prefixer/pull/117) )

### 3.0.0

#### Complete Rewrite
* introducing new core prefixer that perform up to 4.5x faster
* added a whole new generator to create your custom prefixer
* added 4 new plugins to prefix special values
* new documentation using gitbook
* integrated flowtype

------

## 2.0
### 2.0.5
* added style sorting to prepend prefixed properties ( [#105](https://github.com/rofrischmann/inline-style-prefixer/issues/105) )
* support for `position: -webkit-sticky` ( [#103](https://github.com/rofrischmann/inline-style-prefixer/issues/103) )

### 2.0.4
* added type checks for `flexDirection` specification alternatives

### 2.0.3
* fixed updated caniuse-api search keys

### 2.0.2
* fixed a bug that used the prefixAll fallback for Windows Phone browsers ( [#97](https://github.com/rofrischmann/inline-style-prefixer/issues/97) )
* fixed a bug preventing Firefox on Android to correct prefixes ( [#95]((https://github.com/rofrischmann/inline-style-prefixer/issues/95) )

### 2.0.1
* fixed a bug that removed array values ( [#89](https://github.com/rofrischmann/inline-style-prefixer/issues/89) )
* added array prefixing to the dynamic version
* improved prefixing performance


### 2.0.0
##### API Changes
* merged [inline-style-prefix-all](https://github.com/rofrischmann/inline-style-prefix-all) as `inline-style-prefixer/static`

##### Improvements
* support for Chromium browser ( [#75](https://github.com/rofrischmann/inline-style-prefixer/pull/86) )
* support for Vivaldi browser ( [#81](https://github.com/rofrischmann/inline-style-prefixer/pull/81) )
* support for zoom and grab `cursor` values ( [#82](https://github.com/rofrischmann/inline-style-prefixer/pull/82) )
* support for prefixing arrays of values ( [@inline-style-prefix-all#16](https://github.com/rofrischmann/inline-style-prefix-all/pull/16) )

##### Bugs
* fixed a bug where `border` within transitions was treated as `order` ( [@inline-style-prefix-all#15](https://github.com/rofrischmann/inline-style-prefix-all/issues/15) )
* fixed a bug where prefixed transition values where incorrectly concatenated ( [@inline-style-prefix-all#17](https://github.com/rofrischmann/inline-style-prefix-all/issues/17) )


## 1.0
### 1.0.4
* updated inline-style-prefix-all dependency to correct fallback value order

### 1.0.3
* replaced `Set` with ES5 alternative

### 1.0.2
* fixed a bug that caused crashes if `display` got either `null` or `undefined` assigned ( [#71](https://github.com/rofrischmann/inline-style-prefixer/pull/71#issue-139056802) )

### 1.0.1
* added `undefined` check for `userAgent` to prevent bowser errors

### 1.0.0
* pulled a bugfix by Khan Academy that dash-cases fallback properties ( https://github.com/Khan/inline-style-prefixer/commit/f41f3040ac27eeec3b7a1fb7450ddce250cac4e4 )
* using [inline-style-prefix-all](https://github.com/rofrischmann/inline-style-prefix-all) for `prefixAll` now
* `display` does not get removed anymore ( #65 )
* not throwing anymore if unsupported `userAgent` is provided ( #62 )

## 0.6
### 0.6.7
* Fixed a bug that caused `transition` with `cubic-bezier` to resolve false
* Replaced `for of` in favor of a basic `for` loop to not require `Symbol` to be available

### 0.6.6
* Prevent crashes if a value is `false` or `undefined`

### 0.6.5
* Plugins won't crash if a `number` value is passed
* Added default `options`

### 0.6.4
* support for prefixed `transition` properties *e.g. `transition: '-webkit-filter 200ms linear'`*
* wider support for **gradients** on all properties
* `prefixAll` now prefixes all plugin values
* uses default `userAgent` if no userAgent, `undefined` or `false` is passed

### 0.6.3
* added support for Cordova apps & in-app browser *(especially on iOS 8.4.x)*
* fixed Android Chrome detection *(on Android 4.x)*
* added some [FAQ](docs/FAQ.md)'s

### 0.6.2
* fixed dist files to register globally

### 0.6.1
* replaced multi-options with an object hash
* renamed `keepDefaults` to `keepUnprefixed`

### 0.6.0
* fixed a bug that caused the `display:flex` plugin to prefix incorrectly
* added `forceRun`-option to plugins to support plugins when using `prefixAll`
* added `keepDefault`-option to keep defaults after prefixing
* added MS Edge support
* added whitelist for headless browsers
* several data updates

## 0.5
## 0.5.4
* fixed a typo in `animationIterationCount`

## 0.5.3
* Added 2D Transform to the searchMap so IE 9 prefixes `transform`, `transformOrigin`, `transformOriginX` and `transformOriginY`
* Removed unsupported browsers from browser detection to avoid false prefixes

## 0.5.2
* Added Changelog
* Android detection for older Versions (< 5)
* added `flexWrap` to the properties list
