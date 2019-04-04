0.4.1 / 2016-04-13
==================
 * Updated documentation for Jed > 1.1.0
 * Use msgid_plural when there is no translation

0.4.1 / 2015-03-01
==================
 * Updated Jed-format code and test to deal with the new plural form

0.4.0 / 2015-03-01
==================
 * Added Jed > 1.1.0 compatible format (Evan Moses)

0.3.0 / 2014-07-16
==================
 * Added command line flags for fuzzy, pretty, format, and domain (Szigetvári Áron)
 * Deals with fallback-to-msgid for fuzzy entries without the fuzzy flag (Szigetvári Áron)

0.2.4 / 2014-07-15
==================

 * Fixed fuzzy flag (mahata)

0.2.3 / 2014-01-26
==================

 * Raised minimum node version requirement to 0.8
 * Raised lodash version to ~2.4.1
 * Clean up documentations

0.2.0 / 2013-11-08
==================

**NB! This release is NOT backwards-compatible!** It has the following **braking changes**:

 * `po2json.parse_po` has been replaced with `po2json.parse`
 * `po2json.parse` has been replaced with `po2json.parseFile`
 * `po2json.parseSync` has been replaced with `po2json.parseFileSync`

Other changes in this release:

  * The library has been competely rewritten, it now uses the [gettext-parser](https://github.com/andris9/gettext-parser) module to parse PO files. (Illimar Tambek)
  * Tests have been completely rewritten (Illimar Tambek)
  * Fixed issue with double-escaping quotes (Illimar Tambek)
  * Option to skip/include fuzzy translations (Illimar Tambek)


0.0.7 / 2012-10-26
==================

  * Fixed linting bugs and added a better fr.po fixture (Mike Edwards)
  * Add tests for po2json.parse and po2json.parseSync (Dan MacTough)
  * updated README.md with version history (Mike Edwards)
  * updated history (Mike Edwards)

0.0.6 / 2012-10-22
==================

  * Add AUTHORS to identify contributors (Dan MacTough)
  * Update README with revision history and basic examples (Dan MacTough)

0.0.5 / 2012-10-19
==================

  * cut out fake README example from grunt boilerplate (Mike Edwards)
  * fixed README.md markdown (Mike Edwards)
  * fixes tests (Mike Edwards)
  * added first test for parse_po (Mike Edwards)
  * Added boilerplate using grunt init (Mike Edwards)
  * Changed exports.parse to use node's convetional error-first callback style. Added exports.parseSync for synchronous parsing. (Dan MacTough)

0.0.4 / 2012-09-18
==================

  * Properly escape linebreaks (Zach Carter)
  * Update package.json (Mike Edwards)
  * package.json: define main module (Asbjørn Sloth Tønnesen)

0.0.2 / 2012-07-03
==================

  * fix package, fix pretty print return, remove debug logs (gilles)
  * upped version (Mike Edwards)

0.0.1 / 2012-06-06
==================

  * Added build status to README (Mike Edwards)
  * Removed built=ints from the dependencies (Mike Edwards)
  * Added a .travis file for continuous integration (Mike Edwards)
  * Added usage note to README.md (Mike Edwards)
  * First working script! (Mike Edwards)
  * Added new git repo (Mike Edwards)
  * initial commit (Mike Edwards)
  * Initial commit (Mike Edwards)
