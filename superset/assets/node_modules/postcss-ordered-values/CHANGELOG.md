# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 2.2.3

* Resolves an integration issue with css-loader; now this module will ignore
  any declarations that have import placeholders.
* Rewrote the processor structure for improved performance; now there is an
  object of processors instead of an array, and a single value validation step
  instead of one per processor.

# 2.2.2

* Now will not re-order box-shadow values containing `calc()` definitions.

# 2.2.1

* Now will not re-order values that contain any `var()` definitions.

# 2.2.0

* Adds support for re-ordering `transition` declarations.

# 2.1.1

* Fixes an issue where special comments were being discarded by this module.
  Now, property values with any comments in them will be ignored.

# 2.1.0

* Adds support for re-ordering `box-shadow` declarations.

# 2.0.2

* Bump postcss-value-parser to `3.0.1` (thanks to @TrySound).
* Fixes an issue where the module was discarding color codes if a `calc`
  function was found (thanks to @TrySound).

# 2.0.1

* Bump postcss-value-parser to `2.0.2`.

# 2.0.0

* Upgraded to PostCSS 5.

# 1.1.1

* Fixes an issue where `flex` properties were being mangled by the module.

# 1.1.0

* Adds support for `flex-flow` (thanks to @yisibl).

# 1.0.1

* The module will now recognise `auto` as a valid value.

# 1.0.0

* Initial release.
