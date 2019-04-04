# Changelog

## v1.1.0 2015-01-21

  * Added `po.createParseStream` method for parsing PO files from a Stream source
  * Updated documentation

## v1.0.0 2015-01-21

  * Bumped version to 1.0.0 to be compatible with semver
  * Changed tests from nodeunit to mocha
  * Unified code style in files and added jshint task to check it
  * Added Grunt support to check style and run tests on `npm test`

## v0.2.0 2013-12-30

  * Bumped version to 0.2.0
  * Removed node-iconv dependency
  * Fixed a global variable leak (`line` was not defined in `pocompiler._addPOString`)
  * Some code maintenance (applied jshint rules, added "use strict" statements)
  * Updated e-mail address in .travis.yml
  * Added CHANGELOG file
