# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 3.0.0

* Rewrote the module, with lots of bug fixes and improvements to longhand
  merging (thanks to @andyjansson).
* Now supports merging `column-width` & `column-count` into `columns`.
* Now supports merging `border-left-width` (plus the other 3) into
  `border-width`, where the previous behaviour would merge them into `border`.
* Now supports merging single longhand properties into the shorthand, e.g.
  `padding: 2px;padding-top: 5px` becomes `padding: 5px 2px 2px`.
* Better support for browser hacks; the module will not merge properties when
  they have browser hacks applied.

# 2.0.2

* Fixes an issue where properties with the `initial` keyword were being merged
  (thanks to @holmari).

# 2.0.1

* Fixed a crash when the module was trying to retrieve declarations
  from a rule which contained comments in it.

# 2.0.0

* Upgraded to PostCSS 5.

# 1.0.2

* Fixes an issue where properties with the `inherit` keyword were being merged.

# 1.0.1

* Fixes an issue where calc values were being mangled.

# 1.0.0

* Initial release.
