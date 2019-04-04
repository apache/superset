
0.2.0 / 2012-10-19
==================

  * fix isRegExp bug in some edge cases
  * add closure to all assertion messages deferring costly inspects
    until there is actually a failure
  * fix `make test` for recent mochas
  * add inspect() case for DOM elements
  * relax failure msg null check
  * add explicit failure through `expect().fail()`
  * clarified all `empty` functionality in README example
  * added docs for throwException fn/regexp signatures

0.1.2 / 2012-02-04
==================

  * Added regexp matching support for exceptions.
  * Added support for throwException callback.
  * Added `throwError` synonym to `throwException`.
  * Added object support for `.empty`.
  * Fixed `.a('object')` with nulls, and english error in error message.
  * Fix bug `indexOf` (IE). [hokaccha]
  * Fixed object property checking with `undefined` as value. [vovik]

0.1.1 / 2011-12-18
==================

  * Fixed typo

0.1.0 / 2011-12-18
==================

  * Initial import
