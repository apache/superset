# 4.0.0-rc.0

* Breaking: Drops support for Node 0.12, we now require at least Node 4.
* Breaking: Update PostCSS to 6.0.0.

# 1.0.4

* Refactor the main module, slight performance tweak and ±0.9K less file size
  on disk.

# 1.0.3

* The `translate(tx, 0)` compression was changed from `translateX(tx)`
  to `translate(tx)`.

# 1.0.2

* Fixes an incorrect conversion of `translate(5, 5)` to `translate(5)`.

# 1.0.1

* Performance improvements (thanks to @TrySound).

# 1.0.0

* Initial release.
