# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 2.0.4

* Now compiled with Babel 6.

# 2.0.3

* Fixes an issue where comments that were removed from selectors were replaced
  by a single space.

# 2.0.2

* Fixes an integration issue where comments inside values transformed by other
  processors had their values reset to their original state before the
  comments were removed.

# 2.0.1

* Replaces a dependency on node-balanced with internal comments parser.

# 2.0.0

* Upgraded to PostCSS 5 (thanks to @avanes).

# 1.2.1

* Improved performance by iterating the AST in a single pass.

# 1.2.0

* Adds support for user-directed removal of comments, with the `remove`
  option (thanks to @dmitrykiselyov).
* `removeAllButFirst` now operates on each CSS tree, rather than the first one
  passed to the plugin.
* Fixes to pass the PostCSS plugin guidelines.

# 1.1.3

* As PostCSS handles the source map content, there is no need to check for
  the existence of a '#' at position 0 of the comment. This patch fixes this
  behaviour.

# 1.1.2

* Fixes an issue where comment separated values were being incorrectly
  transformed to not have spaces separating them instead, in `decl.value`.
  e.g. `10px/*test*/20px` became `10px20px` in `decl.value` but not
  `decl._value.raw`.

# 1.1.1

* Fixes a bug where non-special comments, with an exclamation mark in any part
  of the text, were not being removed.

# 1.1.0

* Now uses the PostCSS `4.1` plugin API.
* Adds support for transforming comments inside `!important` values.

# 1.0.2

* Adds a JSHint config, tidy up unnecessary lines of code.

# 1.0.1

* Fixed a bug which affected initializing the plugin with no options.
* Stopped the plugin from trying to match comments in empty strings.

# 1.0.0

* Initial release.
