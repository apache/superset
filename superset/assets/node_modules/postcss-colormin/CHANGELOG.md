# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Drops the `legacy` option which was used to provide support for
  legacy IE versions. It has been superseded by using Browserslist to supply
  a list of browsers; we recommend using the config file as the same values will
  be propagated to other cssnano plugins which have the same functionality.
  See https://github.com/ai/browserslist#config-file for more details.
* Breaking: Update PostCSS to 6.0.0.
* postcss-colormin will now no longer handle integer or whitespace compression;
  it's now delegated to postcss-normalize-whitespace & postcss-convert-values.
  We re-integrated colormin back into this module so that it would be clearer
  what postcss-colormin's responsibilities are; which are to facilitate
  conversion between identical colors.

# 2.2.2

* Resolves an issue where the module would mangle the non-standard `composes`
  property when consumed via css-loader.

# 2.2.1

* Resolves an issue where converting an rgb/hsl function next to another token,
  such as `linear-gradient(rgb(10, 10, 10)0%, blue)` would result in a
  mangled value.

# 2.2.0

* Adds support for legacy IE versions (< 10).

# 2.1.8

* Fixes incorrect minification of percentages used by `rgb` functions; i.e.
  `rgb(100%,100%,100%)` was not converted correctly to `#fff`.

# 2.1.7

* Fixes another regression where `hsla(0,0%,100%,.5)` was converted to
  `hsla(0,0%,100%,0.5)`.

# 2.1.6

* Fixes a regression where codes for `rgba` & `hsla` were not correctly
  capped at minimum/maximum values.

# 2.1.5

* Fixes several regressions from 2.1.3 - shorthand hex color minification,
  incorrect conversion to `transparent` from `rgba(255, 255, 255, 0)`
  (thanks to @TrySound).

# 2.1.4

* Fixes an error in the last patch where the `lib` directory was ignored by npm.

# 2.1.3

* Updates postcss-value-parser to version 3 (thanks to @TrySound).
* Removes the dependency on colormin, conversion is now done in-module.

# 2.1.2

* Removed an unnecessary `trim` method that was used to work around a now
  resolved issue in PostCSS (thanks to @TrySound).

# 2.1.1

* Fixed a regression that was compressing space around forward slashes in
  calc functions.

# 2.1.0

* Better support for minifying colors in legacy CSS gradients, switched to
  postcss-value-parser (thanks to @TrySound).

# 2.0.0

* Upgraded to PostCSS 5.

# 1.2.7

* Fixes an issue where IE filter properties were being converted
  erroneously (thanks to @faddee).

# 1.2.6

* Fixed a crash when specifying `inherit` as a value
  to `-webkit-tap-highlight-color`.

# 1.2.5

* Speed up node iteration by calling `eachDecl` once rather than twice.

# 1.2.4

* Fixed an issue caused by upgrading colormin to use ES6.

# 1.2.3

* Fixed an issue where `-webkit-tap-highlight-color` was being incorrectly
  transformed to `transparent`. This is not supported in Safari.

# 1.2.2

* Fixed a bug where the module crashed on parsing comma separated values for
  properties such as `box-shadow`.

# 1.2.1

* Extracted each color logic into a function for better readability.

# 1.2.0

* Now uses the PostCSS `4.1` plugin API.

# 1.1.0

* Now supports optimisation of colors in gradient values.

# 1.0.0

* Initial release.
