# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 2.1.1

* Fixes a compatibility issue with `modular-css` - now the module will only
  use the raw selector value if it equal to the 'cleaned' selector value.

# 2.1.0

* Adds support for converting between similar `:nth-child` selectors. For
  example, `:nth-child(1)` can be converted to `:first-child`, and
  `p:nth-last-child(2n + 1)` converts to `p:nth-last-child(odd)`.

# 2.0.7

* Fixes a regression where postcss-minify-selectors would transform `[title=""]`
  into `[title=]` (thanks to @arperry).

# 2.0.6

* Performance tweaks; now calls `Node#toString()` ~50% less often, removed dead
  branches, extracted each node type into a separate transformer function.
* Resolves an issue where extraneous whitespace around a case-insensitive
  attribute selector (`[href="foo" i]`) would not be removed.

# 2.0.5

* Updated postcss-selector-parser to `2.0.0`.

# 2.0.4

* Now compiled with babel 6.

# 2.0.3

* Fixed an issue where `[a="-"]` was incorrectly minified to `[a=-]`.

# 2.0.2

* Fixed a crash with Polymer mixins; now the module will pass through any
  selector string with a trailing colon.

# 2.0.1

* Replaced javascript-natural-sort with alphanum-sort (thanks to @TrySound).

# 2.0.0

* Upgraded to PostCSS 5.
* At-rule parameter minification was extracted out of this module into
  postcss-minify-params (thanks to @TrySound).

# 1.5.0

* Added support for converting pseudo elements with double colon syntax to
  the single colon syntax.

# 1.4.7

* Further performance improvements by using less postcss-selector-parser
  iterations.

# 1.4.6

* Bump normalize-selector to `0.2.0`, decreases overall package weight.
* Speed up node iteration by calling `eachInside` once rather than twice.

# 1.4.5

* Update normalize-selector to cut down package weight.

# 1.4.4

* Fixed an integration issue with postcss-font-magician.

# 1.4.3

* Fixed an issue where `.from` was transformed to `0%`.

# 1.4.2

* Bump dependencies.
* Fixes for PostCSS plugin guidelines.

# 1.4.1

* Fixes incorrect deduplication of pseudo selector rules.

# 1.4.0

* Update to postcss-selector-parser to greatly improve parsing logic.

# 1.3.1

* Fixes a crash when nothing was passed to `node-balanced`.

# 1.3.0

* Now uses the PostCSS `4.1` plugin API.

# 1.2.1

* Passes original test case in issue 1.

# 1.2.0

* Does not touch quoted values in attribute selectors.
* No longer will mangle values such as `2100%` in keyframes.

# 1.1.0

* Now minifies `from` to `0%` and `100%` to `to` in keyframe declarations.

# 1.0.0

* Initial release.
