## 13.6.0

### ✨ Features and improvements
* Add `clusterProperties` option for aggregated cluster properties ([#2412](https://github.com/mapbox/mapbox-gl-js/issues/2412), fixed by [#7584](https://github.com/mapbox/mapbox-gl-js/pull/7584))
* Add `number-format` expression ([#7626](https://github.com/mapbox/mapbox-gl-js/pull/7626))
* Add `symbol-sort-key` style property ([#7678](https://github.com/mapbox/mapbox-gl-js/pull/7678))

## 13.5.0

### Features and improvements
* Flattens `all` expressions in converted filters ([#7679](https://github.com/mapbox/mapbox-gl-js/pull/7679))
* Compatibility tables are updated ([#7574](https://github.com/mapbox/mapbox-gl-js/pull/7574))

## 13.4.0

### ✨ Features and improvements
* **Tighten style validation**
    * Disallow expressions as stop values ([#7396](https://github.com/mapbox/mapbox-gl-js/pull/7396))
    * Disallow `feature-state` expressions in filters ([#7366](https://github.com/mapbox/mapbox-gl-js/pull/7366))

## 13.3.0

### 🐛 Bug fixes
* **Expressions**
    * Fix `let` expression stripping expected type during parsing ([#7300](https://github.com/mapbox/mapbox-gl-js/issues/7300), fixed by [#7301](https://github.com/mapbox/mapbox-gl-js/pull/7301))
    * Fix superfluous wrapping of literals in `literal` expression ([#7336](https://github.com/mapbox/mapbox-gl-js/issues/7336), fixed by [#7337](https://github.com/mapbox/mapbox-gl-js/pull/7337))
    * Allow calling `to-color` on values that are already of type `Color` ([#7260](https://github.com/mapbox/mapbox-gl-js/pull/7260))
    * Fix `to-array` for empty arrays (([#7261](https://github.com/mapbox/mapbox-gl-js/pull/7261)))
    * Fix identity functions for `text-field` when using formatted text ([#7351](https://github.com/mapbox/mapbox-gl-js/pull/7351))
    * Fix coercion of `null` to `0` in `to-number` expression ([#7083](https://github.com/mapbox/mapbox-gl-js/issues/7083), fixed by [#7274](https://github.com/mapbox/mapbox-gl-js/pull/7274))

### ✨ Features and improvements
*  Add `fill-extrusion-vertical-gradient` property for controlling shading of fill extrusions ([#5768](https://github.com/mapbox/mapbox-gl-js/issues/5768), fixed by [#6841](https://github.com/mapbox/mapbox-gl-js/pull/6841))

## 13.2.0

### 🐛 Bug fixes
* Update the style-spec's old `gl-style-migrate` script to include conversion of legacy functions and filters to their expression equivalents ([#6927](https://github.com/mapbox/mapbox-gl-js/issues/6927), fixed by [#7095](https://github.com/mapbox/mapbox-gl-js/pull/7095))

### ✨ Features and improvements
* Add `symbol-z-order` symbol layout property to style spec ([#7219](https://github.com/mapbox/mapbox-gl-js/pull/7219))
* Implement data-driven styling support for `*-pattern properties` ([#6289](https://github.com/mapbox/mapbox-gl-js/pull/6289))

## 13.1.1

### 🐛 Bug fixes
* Fix broken module import in mapboxgl-style-spec (v13.0.1) ([#6984](https://github.com/mapbox/mapbox-gl-js/issues/6984), fixed by [#6997](https://api.github.com/repos/mapbox/mapbox-gl-js/pulls/6997))

### ✨ Features and improvements
* Improve formatting for style output ([#7029](https://github.com/mapbox/mapbox-gl-js/pull/7029))

## 13.1.0

### ✨ Features and improvements
* Add `raster-resampling` raster paint property ([#6411](https://github.com/mapbox/mapbox-gl-js/pull/6411)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Add `symbol-placement: line-center` ([#6821](https://github.com/mapbox/mapbox-gl-js/pull/6821))

## 13.0.1

### ⚠️ Breaking changes
* Align implicit type behavior of `match` expressions with with `case/==` ([#6684](https://github.com/mapbox/mapbox-gl-js/pull/6684))
* Update spec so that documentation can automatically capture which functions and expressions can be used with which properties ([#6521](https://github.com/mapbox/mapbox-gl-js/pull/6521))

### ✨ Features and improvements
* Add `feature-state` [#6263](https://github.com/mapbox/mapbox-gl-js/pull/6263)
* Add support for GeoJSON attribution ([#6364](https://github.com/mapbox/mapbox-gl-js/pull/6364)) (h/t [andrewharvey](https://github.com/andrewharvey))
* Upgrade to Flow 0.69 ([#6594](https://github.com/mapbox/mapbox-gl-js/pull/6594))

### 🐛 Bug fixes
* Use named exports for style-spec entrypoint module ([#6601](https://github.com/mapbox/mapbox-gl-js/issues/6601)

## 13.0.0
Malformed package published to NPM.

## 12.0.0

### ⚠️ Breaking changes
* The `"to-string"` expression operator now converts null to an empty string rather than to `"null"`. [#6534](https://github.com/mapbox/mapbox-gl-js/pull/6534)

### ✨ Features and improvements
* 🌈 Add line-gradient property [#6303](https://github.com/mapbox/mapbox-gl-js/pull/6303)
* Add collator expression for controlling case and diacritic sensitivity in string comparisons [#6270](https://github.com/mapbox/mapbox-gl-js/pull/6270)
* Add `is-supported-script` expression for determining if a script is supported. [#6260](https://github.com/mapbox/mapbox-gl-js/pull/6260)
* Add `collator` expression for controlling case and diacritic sensitivity in string comparisons [#6270](https://github.com/mapbox/mapbox-gl-js/pull/6270)
* Add `abs`, `round`, `floor`, and `ceil` expression operators [#6496](https://github.com/mapbox/mapbox-gl-js/pull/6496)
* Add support for Mapzen Terrarium tiles in raster-dem sources [#6110](https://github.com/mapbox/mapbox-gl-js/pull/6110)

### 🐛 Bug fixes
- Fix Rollup build [6575](https://github.com/mapbox/mapbox-gl-js/pull/6575)

## 11.1.1

### 🐛 Bug fixes

* Update SDK support information for `text-font`, and `heatmap-color`, and `hillshade` layer properties.

## 11.1.0

### ✨ Features and improvements

* Avoid use of `new Function` for filters by converting old-style filters to expressions [#5665](https://github.com/mapbox/mapbox-gl-js/pull/5665).

## 11.0.0

### ⚠️ Breaking changes

* Remove constants validating code [#5885](https://github.com/mapbox/mapbox-gl-js/pull/5885)
* `"colorSpace": "hcl"` now uses shortest-path interpolation for hue [#5811](https://github.com/mapbox/mapbox-gl-js/issues/5811)

### ✨ Features and improvements

* Introduce client-side hillshading with `raster-dem` source type and `hillshade` layer type [#5286](https://github.com/mapbox/mapbox-gl-js/pull/5286)
* Add Color#toString and expose Color publicly [#5866](https://github.com/mapbox/mapbox-gl-js/pull/5866)
* Improve typing for `==` and `!=` expressions [#5840](https://github.com/mapbox/mapbox-gl-js/pull/5840)
* Made `coalesce` expressions more useful [#5755](https://github.com/mapbox/mapbox-gl-js/issues/5755)
* Enable implicit type assertions for array types [#5738](https://github.com/mapbox/mapbox-gl-js/pull/5738)

### 🐛 Bug fixes

* Fix standalone browser build [#5736](https://github.com/mapbox/mapbox-gl-js/pull/5736), [#5906](https://github.com/mapbox/mapbox-gl-js/pull/5906)
* Handle NaN as input to step and interpolate expressions [#5757](https://github.com/mapbox/mapbox-gl-js/pull/5757)
* Fix style diffing for changes to GeoJSON sources [#5745](https://github.com/mapbox/mapbox-gl-js/pull/5745)
* Mark layer "type" property as required [#5849](https://github.com/mapbox/mapbox-gl-js/pull/5849)

## 10.1.0

* Remove support for validating and migrating v6 styles [#5604](https://github.com/mapbox/mapbox-gl-js/pull/5604)
* Remove support for validating v7 styles [#5604](https://github.com/mapbox/mapbox-gl-js/pull/5604)
* Remove spaces after commas in `to-string` representation of colors [#5480](https://github.com/mapbox/mapbox-gl-js/pull/5480)
* Fix bugs preventing `mapbox-gl-style-spec` package on NPM from being used externally [#5502](https://github.com/mapbox/mapbox-gl-js/pull/5502)
* Fix flow-typed interface generator [#5478](https://github.com/mapbox/mapbox-gl-js/pull/5478)
* Export `function` [#5584](https://github.com/mapbox/mapbox-gl-js/pull/5584)
* Export `StylePropertySpecification` type [#5593](https://github.com/mapbox/mapbox-gl-js/pull/5593)
* Split the `source_tile` entry in the JSON schema into `source_vector` and `source_raster` [#5604](https://github.com/mapbox/mapbox-gl-js/pull/5604)

### Validation Changes

* Require that `heatmap-color` use expressions instead of stop functions [#5624](https://github.com/mapbox/mapbox-gl-js/issues/5624)
* Remove support for including `{tokens}` in expressions for `text-field` and `icon-image` [#5599](https://github.com/mapbox/mapbox-gl-js/issues/5599)
* Disallow interpolation in expressions for `line-dasharray` [#5519](https://github.com/mapbox/mapbox-gl-js/pull/5519)
* Validate that zoom expressions only appear at the top level of an expression [#5609](https://github.com/mapbox/mapbox-gl-js/issues/5609)
* Validate that `step` and `interpolate` expressions don't have any duplicate stops [#5605](https://github.com/mapbox/mapbox-gl-js/issues/5605)
* Split `curve` expression into `step` and `interpolate` expressions [#5542](https://github.com/mapbox/mapbox-gl-js/pull/5542)
* Validate expression values for enum-typed properties [#5589](https://github.com/mapbox/mapbox-gl-js/pull/5589)
* Improve validation to catch uses of deprecated function syntax [#5667](https://github.com/mapbox/mapbox-gl-js/pull/5667)

## 10.0.1

* Fix bug preventing @mapbox/mapbox-gl-style-spec package from being usable outside of mapbox-gl-js (#5502)

## 10.0.0

* Add expression and heatmap layer support. See Mapbox GL JS v0.40.1 changelog entry for details.

## 9.0.1

* Remove `fast-stable-stringify` dependency (#5152)

## 9.0.0

* Fix validation error on categorical zoom-and-property functions (#4220)
* Relax requirement that styles using "icon-image" must have a "sprite"
* Prevent infinite loop in binarySearchForIndex when duplicate stops are present. (#4503)
* Ensure generated composite function stops are in the correct order (#4509)
* Update SDK support matrices to be current as of GL JS v0.35.1, iOS SDK v3.5.0, Android SDK 5.0.0
* Remove support for implicitly-categorical functions
* BREAKING CHANGE: the API for the `function` module has changed. The `interpolated` and `piecewise-constant` exports
were replaced with a single unnamed export, a function which accepts an object conforming to the style spec "function"
definition, and an object defining a style spec property. It handles color parsing and validation of feature values
internally.
* Functions now support a "default" property.
* `parseColor` was promoted from gl-js.

## 8.11.0

* Merge `feature-filter` repository into this repository #639

## 8.10.0

v8.0.0 styles are fully compatible with v8.10.0.

### Style Specification Changes

* Added `colorSpace` option to functions
* Added `fill-extrusion` layer type
* Add top-level `light` property
* Remove increase maximum `maxzoom` to 24
* Deprecate paint classes :warning:
* Increase strictness of function validation

### Reference JSON & API Changes

* Added `deref` utility
* Added `group_by_layout` utility
* Merge `mapbox-gl-function` repository into this repository

## 8.9.0

v8.0.0 styles are fully compatible with v8.9.0.

* Added identity functions
* Added `auto` value which represents the calculated default value

## 8.8.1

v8.0.0 styles are fully compatible with v8.8.1.

* Fixed style validation for layers with invalid types

## 8.8.0

v8.0.0 styles are fully compatible with v8.8.0.

* Clarified documentation around fill-opacity.
* Update function documentation and validation for property functions.
* Add text-pitch-alignment property.
* Add icon-text-fit, icon-text-fit-padding properties.

## 8.7.0

v8.0.0 styles are fully compatible with v8.7.0.

* Add support for has / !has operators.

## 8.6.0

v8.0.0 styles are fully compatible with v8.6.0.

* Added support for zoom and feature driven functions.

## 8.4.2

v8.0.0 styles are fully compatible with v8.4.2.

* Refactored style validator to expose more granular validation methods

## 8.4.1

v8.0.0 styles are fully compatible with v8.4.1.

* Revert ramp validation checks that broke some styles.

## 8.4.0

v8.0.0 styles are fully compatible with v8.4.0.

* Added `cluster`, `clusterRadius`, `clusterMaxZoom` GeoJSON source properties.

## 8.3.0

v8.0.0 styles are fully compatible with v8.3.0.

* Added `line-offset` style property

## 8.2.1

v8.0.0 styles are fully compatible with v8.2.1.

* Enforce that all layers that use a vector source specify a "source-layer"

## 8.2.0

v8.0.0 styles are fully compatible with v8.2.0.

* Add inline `example` property.
* Enforce that all style properties must have documentation in `doc` property.
* Create minified style specs with `doc` and `example` properties removed.
* `validate` now validates against minified style spec.
* `format` now accepts `space` option to use with `JSON.stringify`.
* Remove `gl-style-spritify`. Mapbox GL sprites are now created automatically by
  the Mapbox style APIs, or for hand-crafted styles, by [spritezero-cli](https://github.com/mapbox/spritezero-cli).

## 8.1.0

v8.0.0 styles are fully compatible with v8.1.0.

* [BREAKING] Simplified layout/paint layer property types to more closely align
  with v7 types.
* Fixed migration script compatibility with newer versions of Node.js and io.js
* Removed `constants` from schema, they were deprecated in v8
* Added style diff utility to generate semantic deltas between two stylesheets
* Added `visibility` property to `circle` layer type
* Added `pitch` property to stylesheet

## 8.0.0

Introduction of Mapbox GL style specification v8. To migrate a v7 style to v8,
use the `gl-style-migrate` script as described in the README.

* [BREAKING] The value of the `text-font` property is now an array of
  strings, rather than a single comma separated string.
* [BREAKING] Renamed `symbol-min-distance` to `symbol-spacing`.
* [BREAKING] Renamed `background-image` to `background-pattern`.
* [BREAKING] Renamed `line-image` to `line-pattern`.
* [BREAKING] Renamed `fill-image` to `fill-pattern`.
* [BREAKING] Renamed the `url` property of the video source type to `urls`.
* [BREAKING] Coordinates in video sources are now specified in [lon, lat] order.
* [BREAKING] Removed `text-max-size` and `icon-max-size` properties; these
  are now calculated automatically.
* [BREAKING] `text-size` and `icon-size` are now layout properties instead of paint properties.
* [BREAKING] Constants are no longer supported. If you are editing styles by
  hand and want to use constants, you can use a preprocessing step with a tool
  like [ScreeSS](https://github.com/screee/screess).
* [BREAKING] The format for `mapbox://` glyphs URLs has changed; you should
  now use `mapbox://fonts/mapbox/{fontstack}/{range}.pbf`.
* [BREAKING] Reversed the priority of layers for calculating label placement:
  labels for layers that appear later in the style now have priority over earlier
  layers.
* Added a new `image` source type.
* Added a new `circle` layer type.
* Default map center location can now be set in the style.
* Added `mapbox://` sprite URLs `mapbox://sprite/{user | "mapbox"}/{id}`

## 7.5.0

* Added gl-style-composite script, for auto-compositing sources in a style.

## 7.4.1

* Use JSON.stringify for formatting instead of js-beautify

## 7.0.0

Introduction of Mapbox GL style specification v7.

* [BREAKING] Improve dashed lines (#234)
* [BREAKING] Remove prerendered layers (#232)
* Explicit visibility property (#212)
* Functions for all properties (#237)

## 6.0.0 (Style spec v6)

Introduction of Mapbox GL style specification v6.

* [BREAKING] New filter syntax (#178)
* [BREAKING] Line gap property (#131)
* [BREAKING] Remove dashes from min/max-zoom (#175)
* [BREAKING] New layout/paint terminology (#166)
* [BREAKING] Single text positioning property (#197)
* Added requirements (#200)
* Added minimum, maximum, and period values (#198)

## 0.0.5 (in progress)

* [BREAKING] Switch to suffix for transition properties (`transition-*` -> `*-transition`).
* Added support for remote, non-Mapbox TileJSON sources.
* [BREAKING] Source `minZoom` and `maxZoom` renamed to `minzoom` and `maxzoom to match TileJSON.
* Added support for `mapbox://` glyph URLs.
* [BREAKING] Renamed `raster-fade` to `raster-fade-duration`.
* Added background-opacity property.
* Added "tokens" property to string values that can autocomplete fields from layers
* Added "units" property to describe value types

## 0.0.4 (Aug 8 2014)

* Initial public release
