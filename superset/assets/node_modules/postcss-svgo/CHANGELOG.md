# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 2.1.6

* Resolves an issue where postcss-svgo would convert colours to hex codes
  without URL-encoding the `#`.

# 2.1.5

* Bump svgo to v0.7.x.

# 2.1.4

* Fixes an issue where postcss-svgo would throw with some SVGs that were
  not properly URI encoded.

# 2.1.3

* Upgrade is-svg to version 2.

# 2.1.2

* Fixes an issue with processing some malformed URIs (thanks to @TrySound).

# 2.1.1

* Bump SVGO to 0.6.1 (thanks to @shinnn).

# 2.1.0

* Adds `encode` option (thanks to @TrySound).

# 2.0.4

* Updates postcss-value-parser to version 3 (thanks to @TrySound).

# 2.0.3

* Uses postcss-value-parser instead of async-replace to reduce cssnano's
  download size (thanks to @TrySound).

# 2.0.2

* Fixed an issue where the module was not handling exceptions from
  decoding URLs.
* The module will now convert all SVG wrapping quotes to single quotes, which
  is consistent with SVGO's output.

# 2.0.1

* Fixed an issue where the `charset` definition was being removed from the
  SVG source, breaking IE compatibility (thanks to @ophyros).

# 2.0.0

* Upgraded to PostCSS 5.0.

# 1.1.0

* Adds support for uri-encoded SVG files, for better compatibility
  with postcss-svg.

# 1.0.1

* Push ES5 build to npm.

# 1.0.0

* Initial release.
