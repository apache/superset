# Head

* Resolves an issue with mangling css-modules' `@value` at-rule.

# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 1.2.2

* Resolves an issue where `all and` would be removed from
  `@media not all and (conditions) {}`, causing an invalid media query to
  be output.

# 1.2.1

* Resolves an issue where `1.2.0` would throw on empty function parentheses.

# 1.2.0

* Adds support for simplifying `min-aspect-ratio` and `max-aspect-ratio`. For
  example, `@media (min-aspect-ratio: 1280/720) {}` can be minified to
  `@media (min-aspect-ratio:16/9){}`.

# 1.1.0

* Adds support for removing the unnecessary `all and` from media queries.

# 1.0.1

* Refactor to ES6.

# 1.0.0

* Initial release.
