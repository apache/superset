# master

# 1.2.3

* Don't silently ignore incorrect `be` usage (#39)

# 1.2.2

* Improve failure messages for html, text, and value assertions

# 1.2.1

* Fix chainability of `contain`

# 1.2.0

* Add `enabled` assertion
* Add `prop` assertion

# 1.1.2

* Support for IE and other implementations without __proto__.

# 1.1.1

* Support inspect with 0 depth
* Set jQuery as an AMD dependency

# 1.1.0

* Fix override of 'have' so it only returns the have function when called on a
  non-jQuery object.
* Fix data assertion chaining
* Added `css` and `empty` assertions

# 1.0.0

* Compatibility with chai 1.0.0
* Breaking change: the `contains` assertion now uses jQuery's `:contains`
  selector. The previous behavior of the `contains` assertion is now handled by
  the `have` assertion, corresponding to jQuery's `.has()` function.
