# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.
* Better handling of color stop positions in radial gradients, the module now
  correctly accounts for the first set of parameters potentially being
  directional and not stop values.

# 1.0.5

* Resolves a crash on empty `linear-gradient()` functions.

# 1.0.4

* Resolves an issue where `0` was being removed from intermediate colour stops
  if preceding colour stops contained `calc()` (thanks to @jaybekster).

# 1.0.3

* Resolves an issue where `0` was being incorrectly stripped from the final
  colour stop value.

# 1.0.2

* Resolves an issue where the module would incorrectly parse floating
  point numbers.

# 1.0.1

* Reduce function iterations (thanks to @TrySound).

# 1.0.0

* Initial release.
