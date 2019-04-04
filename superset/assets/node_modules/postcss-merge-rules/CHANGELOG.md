# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.
* Update Browserslist to 2.0.0.

# 2.1.2

* Performance improvements; no compatibility checking for simple selectors,
  cached compatibility lookups, and early exit on compatibility mismatches
  (thanks to @akx).

# 2.1.1

* Resolves an issue with `2.1.0` where `browserslist` was not being installed
  correctly on older Node versions.

# 2.1.0

* Rules are now merged based on supported browsers, which uses `browserslist`
  & `caniuse-api`. The browsers should be supplied by the standard means of
  [configuring `browserslist`][browserslist], either using config files or
  via environment variables.

[browserslist]: https://github.com/ai/browserslist#config-file

# 2.0.11

* Resolves an issue where partially identical properties would be removed from
  a rule erroneously; for example `color: #fff` would be removed if the other
  rule contained `background-color: #fff`.

# 2.0.10

* Replaces the internal list of vendor prefixes with the `vendors` module
  (now, some less widely used prefixes are supported).

# 2.0.9

* Resolves an issue where the module would merge rules that had colliding
  vendor prefixed properties and specification properties.

# 2.0.8

* Resolves an issue where selectors inside `@keyframes` would be merged,
  causing a break in Safari.

# 2.0.7

* Resolves an issue where merging was not respecting property order, in cases
  where both shorthand definitions and longhand definitions existed. Now,
  these cases will not be merged (thanks to @11bit).

# 2.0.6

* Fixes an issue where forward merging was not checking that the merge candidate
  was safe to merge (either contains no vendor prefixes,
  or the same vendor prefixes).

# 2.0.5

* Replaced PostCSS' `cloneBefore` with custom clone method to handle `null`
  values properly.

# 2.0.4

* Fixes a crash when cloning a `null` object property (thanks to @JMoxey).

# 2.0.3

* Fixed an issue where the module was incorrectly merging across `@font-face`
  at-rules.

# 2.0.2

* Fixed an issue where keyframes with the same name were being merged together
  incorrectly.

# 2.0.1

* Fixed a crash when `rule.nodes` was not defined.

# 2.0.0

* Upgraded to PostCSS 5.

# 1.3.6

* Minor boost in performance with reduced stringify passes.

# 1.3.5

* Improves merging of adjacent rules with identical selectors.

# 1.3.4

* Fixes an issue where in some cases, non-adjacent rule merging was being
  performed.

# 1.3.3

* Fixes an issue where the wildcard hack (`*zoom: 1`) was being propagated to
  other properties erroneously.
* Better merging logic in some cases.

# 1.3.2

* Fixes a behaviour in which comment nodes were being processed by the
  partial declaration merging logic.

# 1.3.1

* Fixes a behaviour in which rule adjacent forward nodes were not being type
  checked before they were merged.
* Compatibility fixes for the PostCSS plugin guidelines.

# 1.3.0

* Better support for merging properties without the existance of a shorthand
  override.
* Can now 'merge forward' adjacent rules as well as the previous 'merge behind'
  behaviour, leading to better compression.

# 1.2.2

* Fixed an issue where the plugin crashed if node.parent was undefined.

# 1.2.1

* Fixed a bug where media queries were being merged when their parameters were
  different.

# 1.2.0

* Now uses the PostCSS `4.1` plugin API.

# 1.1.1

* Bugfix of last release, now difference is calculated in both directions.

# 1.1.0

* Less eager moving of properties, to avoid cases where moving a longhand
  property would allow a shorthand property to override it.

# 1.0.0

* Initial release.
