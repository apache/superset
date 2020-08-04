# po2json

[![Build Status](https://secure.travis-ci.org/mikeedwards/po2json.png?branch=master)](http://travis-ci.org/mikeedwards/po2json)
[![Dependency Status](https://david-dm.org/mikeedwards/po2json.png?theme=shields.io)](https://david-dm.org/mikeedwards/po2json)
[![devDependency Status](https://david-dm.org/mikeedwards/po2json/dev-status.png?theme=shields.io)](https://david-dm.org/mikeedwards/po2json#info=devDependencies)

[![NPM](https://nodei.co/npm/po2json.png)](https://nodei.co/npm/po2json/)

Convert PO files to Javascript objects or JSON strings. The result is Jed-compatible.

## Getting Started
Install the module with: `npm install po2json`

### As a library
```
var po2json = require('po2json');
```

### As an executable
```
po2json translation.po translation.json
```

## Documentation

### Methods

po2json has 3 methods, all of which take exactly the same options. The main function is `parse` which actually does the parsing to JSON. The 2 others - `parseFile` and `parseFileSync` are convenience functions to directly read PO data from a file and convert it to JSON.

Parse a PO buffer to JSON

* `po2json.parse(buf[, options])`
	* `buf` - a _po_ file as a Buffer or an unicode string.
	* `options` - an optional object with the following possible parameters:
		* `fuzzy` Whether to include fuzzy translation in JSON or not. Should be either `true` or `false`. Defaults to `false`.
		* `stringify` If `true`, returns a JSON string. Otherwise returns a plain Javascript object. Defaults to `false`.
		* `pretty` If `true`, the resulting JSON string will be pretty-printed. Has no effect when `stringify` is `false`. Defaults to `false`
		* `format` Defaults to `raw`.
			* `raw` produces a "raw" JSON output
			* `jed` produces an output that is 100% compatible with Jed < 1.1.0
			* `jed1.x` produces an output that is 100% compatible with Jed >= 1.1.0
			* `mf` produces simple key:value output.
		* `domain` - the domain the messages will be wrapped inside. Only has effect if `format: 'jed'`.

Parse a PO file to JSON

* `po2json.parseFile(fileName[,options], cb)`
	* `fileName` - path to the po file
	* `options` - same as for `po2json.parse`
	* `cb` - a function that receives 2 arguments: `err` and `jsonData`

Parse a PO file to JSON (synchronous)

* `po2json.parseFileSync(fileName[, options])`
	* `fileName` - path to the po file
	* `options` - same as for `po2json.parse`

#### fallback-to-msgid
If `fallback-to-msgid` is set, for those entries that would be omitted
(fuzzy entries without the fuzzy flag) and for those that are empty,
the msgid will be used as translation in the json file.
If the entry is plural, msgid_plural will be used for msgstr[1].
This means that this option makes sense only for those languages
that have nplurals=2.

### Command Line Arguments

po2json in command-line parametrization support added to allow override
default options.

* --pretty, -p: same as pretty = true in function options
* --fuzzy, -F:  same as fuzzy = true in function options
* --format, -f: Output format (raw, jed, jed1.x, or mf)
* --domain, -d: same as domain in function options

Note: `'format': 'mf'` means the json format used by messageFormatter in github.com/SlexAxton/messageformat.js
This system does any pluralization within the string, so only msgstr[0] is used with these format, in a simple "key": "value" form.

## Examples

### Basic usage with PO data as a buffer/string
```
var po2json = require('po2json'),
    fs = require('fs');
fs.readFile('messages.po', function (err, buffer) {
  var jsonData = po2json.parse(buffer);
  // do something interesting ...
});
```

### Parse a PO file directly - Asynchronous Usage
```
var po2json = require('po2json');
po2json.parseFile('messages.po', function (err, jsonData) {
    // do something interesting ...
});
```

### Parse a PO file directly - Synchronous Usage
```
var po2json = require('po2json');
var jsonData = '';
try {
    jsonData = po2json.parseFileSync('messages.po');
    // do something interesting ...
} catch (e) {}
```

### Parse a PO file to Jed format
```
var po2json = require('po2json'),
    Jed = require('jed');
po2json.parseFile('messages.po', { format: 'jed' }, function (err, jsonData) {
    var i18n = new Jed( jsonData );
});
```

### Running tests
```
npm test
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [grunt](https://github.com/gruntjs/grunt).

## Release History
### 0.4.2 / 2015-04-13
 * Updated documentation for Jed > 1.1.0
 * Use msgid_plural when there is no translation

### 0.4.1 / 2015-03-01
 * Updated Jed-format code and test to deal with the new plural form

### 0.4.0 / 2015-03-01
 * Added Jed > 1.1.0 compatible format (Evan Moses)

### 0.3.0 / 2014-07-16
 * Added command line flags for fuzzy, pretty, format, and domain (Szigetvári Áron)
 * Deals with fallback-to-msgid for fuzzy entries without the fuzzy flag (Szigetvári Áron)

### 0.2.4 / 2014-07-15

 * Fixed fuzzy flag (mahata)

### 0.2.3 / 2014-01-26

 * Raised minimum node version requirement to 0.8
 * Raised lodash version to ~2.4.1
 * Clean up documentations

### 0.2.0 / 2013-11-08

**NB! This release is NOT backwards-compatible!** It has the following **breaking changes**:

 * `po2json.parse_po` has been replaced with `po2json.parse`
 * `po2json.parse` has been replaced with `po2json.parseFile`
 * `po2json.parseSync` has been replaced with `po2json.parseFileSync`

Other changes in this release:

  * The library has been competely rewritten, it now uses the [gettext-parser](https://github.com/andris9/gettext-parser) module to parse PO files. (Illimar Tambek)
  * Tests have been completely rewritten (Illimar Tambek)
  * Fixed issue with double-escaping quotes (Illimar Tambek)
  * Option to skip/include fuzzy translations (Illimar Tambek)

### 0.0.7 / 2012-10-26

  * Fixed linting bugs and added a better fr.po fixture (Mike Edwards)
  * Add tests for po2json.parse and po2json.parseSync (Dan MacTough)
  * updated README.md with version history (Mike Edwards)
  * updated history (Mike Edwards)

### 0.0.6 / 2012-10-22

  * Add AUTHORS to identify contributors (Dan MacTough)
  * Update README with revision history and basic examples (Dan MacTough)

### 0.0.5 / 2012-10-19

  * cut out fake README example from grunt boilerplate (Mike Edwards)
  * fixed README.md markdown (Mike Edwards)
  * fixes tests (Mike Edwards)
  * added first test for parse_po (Mike Edwards)
  * Added boilerplate using grunt init (Mike Edwards)
  * Changed exports.parse to use node's convetional error-first callback style. Added exports.parseSync for synchronous parsing. (Dan MacTough)

### 0.0.4 / 2012-09-18

  * Properly escape linebreaks (Zach Carter)
  * Update package.json (Mike Edwards)
  * package.json: define main module (Asbjørn Sloth Tønnesen)

### 0.0.2 / 2012-07-03

  * fix package, fix pretty print return, remove debug logs (gilles)
  * upped version (Mike Edwards)

### 0.0.1 / 2012-06-06

  * Added build status to README (Mike Edwards)
  * Removed built=ints from the dependencies (Mike Edwards)
  * Added a .travis file for continuous integration (Mike Edwards)
  * Added usage note to README.md (Mike Edwards)
  * First working script! (Mike Edwards)
  * Added new git repo (Mike Edwards)
  * initial commit (Mike Edwards)
  * Initial commit (Mike Edwards)

## License
Copyright (c) 2012 Joshua I. Miller
Licensed under the GNU, Library, General, Public, License licenses.
