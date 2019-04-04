# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.
* Added: This module can now convert initial values *to* the `initial` keyword,
  but only when the browser support is sufficient. You may use Browserslist to
  supply a list of browsers; we recommend using the config file as the same
  values will be propagated to other cssnano plugins which have the same
  functionality. See https://github.com/ai/browserslist#config-file for
  more details.

# 1.0.1

* Update the initial value of `user-select` from `none` to `auto`.

# 1.0.0

* Initial release.
