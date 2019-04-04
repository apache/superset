## 3.9.0

2018-11-28
  - Added `range([start=1], end, [step=1])` function to generate lists
  - Fixes #3325 #3313 #3328

## 3.8.1

2018-08-07
  - Fixes for sourcemaps and color functions
  - Support for #RRGGBBAA color format
  - Allows conversion of colors to `rgba()` or `hsla()`
  - Pass-through output of unknown properties in color functions (allows `var(--color)` for example)

## 3.8.0

2018-07-22
  - New feature: added rewrite urls to replace relative url option. Adds "local" option for modules

## 3.7.1

2018-07-11
  - Fixes mistake in `lessc` (using `console.warning` instead of actual `console.warn`)
  - Adds `lessc` tests

## 3.7.0

2018-07-11
  - New each() function! [See docs](http://lesscss.org/functions/#list-functions-each)
  - New math modes! Also [see docs](http://lesscss.org/usage/#less-options-math).
  - Bug fixes

## 3.6.0

2018-07-10
  - Allows plain conditions in `if(true, 1, 2)` (vs. `if((true), 1, 2)`)
  - Fixes svg-gradient() for Firefox
  - Adds more 3rd-party tests for fewer surprises when upgrading
  - Removes (broken) `less-rhino` implementation - use other Java ports

## 3.5.3

2018-07-06
  - Reverts `@media` eval change
  - Other bug fixes

## 3.5.0

2018-07-05
  - Feature: Namespaced Values / Maps e.g. `color: @color[primary]`
  - Fixes to calc()
  - Permissive parsing of custom properties and variables
  - Inline expressions now not evaluated in at-rules `@media (min-width: @var) {}` works, `@media (min-width: @var + 1) {}` will not
  - Allows unnamed lookups i.e. "functions" e.g. `.mixin(@a, @b)[]`
  - Lots of bug fixes

## 3.5.0-beta.4

2018-06-30
  - Fixes #3235, #3187
  - Feature: Namespaced Values e.g. `color: #color[primary]`

## 3.5.0-beta.3

2018-06-29
  - Fix: browser cache is always considered stale if .modifyVars wasn't

## 3.5.0-beta.2

2018-06-27
  - Re-parses selectors after variables in selectors are evaluated - Fixes #1421
  - Fixes #3191

## 3.5.0-beta

2018-06-24
  - Adds permissive parsing for at-rules and custom properties - fixes #3147 #2715 
  - Updates dependencies
  - Fixes file caching issue (not reloading modified files in "watched" environments)

## 3.0.4

2018-05-06
  - Update source-map to 0.6.x (#3180). Enforces node 6+ though.

## 3.0.0

2018-02-10
  - Fix `calc()` function to not do math operations on compile
  - Rename Directive -> AtRule & Rule -> Declaration
  - Cross-platform `@plugin` loading! (Node & Browser)
  - Numerous changes / improvements to plugin architecture
  - Simplified API calls in plugins (`less.atrule()` vs `new less.tree.AtRule()`)
  - Property accessors (`$width` to refer to `width: 300px` value)
  - Inline JavaScript disabled by default for security reasons (use `@plugin`)
  - Improvements in Less error reporting
  - Added feature: returning `null` / `false` from Less functions will remove that line
  - Simple `boolean()` and `if()` functions added
  - Bug fixes
  - Removal of unnecessary nodes from API (like IE's `alpha()`)

## 2.7.3

2017-10-23

  - Bump `request` dependency

## 2.7.2

2017-01-04

  - Revert breaking changes to contrast() function
  - Fix error reporting of lessc executable
  - Changed octals to hex for ES6 strict mode

## 2.7.1 HOTFIX

2016-05-09

 - Revert commit 470af20 (source map performance) which broke source maps

## 2.7.0

2016-05-07

 - Fixes for contrast() function
 - Allow root functions for plugins
 - Allow semi-colon separators in functions
 - Performance improvements for source maps
 - Fix "blank page" issue in browser
 - Compatibility fixes for Node 6.x
 - Fix AST to include single-line comments
 - Fix reversion for "color-like" words (outputting color values)

## 2.6.1

2016-03-04

 - Update Less.js dependencies
 - Fix comments after named color regression
 - use instanceof operator instead of class comparison optimization
 - disallow whitespace in variable calls

## 2.6.0

2016-01-29

 - Underscore now allowed in dimension unit
 - Fixes for import by reference
 - Fix for #2384 Changes HTTPRequest "sync" setting to simply hide the page until less has rendered, browser version is now orders of magnitude faster.
 - Added ability to cache stylesheets while using modifyVars
 - Error when when image-size functions are used in browser-less
 - Fixed extend leaking through nested parent selector. #2586
 - Added "or" keyword and allowed arbitrary logical expression in guards
 - Fixing #2124 - Parsing Error "Unrecognised input" for color operations
 - Logical operator ```and``` now has higher precedence than logical operator ```or```.
 - Allow unknown at-rules w/o {} block

## 2.5.3

2015-09-25

 - Fix import inline a URL

## 2.5.2

2015-09-24

 - No output should result in an empty sourcemap
 - Import inline located inside file imported by reference should not be present in output
 - Shorthand colors will stay shorthand
 - Make percentage work like other math functions and throw an error on NaN
 - Fixed mixin definition matching problem when mixin definition contains parameters with default values
 - Observe reference for imported comments

## 2.5.1

2015-05-21

 - Fix problems with less being async in some browsers
 - Minor fix only likely to affect programmatic usage of ruleset find
 - Fix  error when a namespaced mixin is invoked in global scope

## 2.5.0

2015-04-03

 - supports the scoped `@plugin` directive to load function plugins
 - All directives are bubbled (e.g. supports), not just media
 - Performance improvements to the parser - should help non-chrome browsers with very large less files to be a lot quicker.
 - the image size function respects include paths like other file functions
 - colour functions take a relative argument that applies percentages relatively instead of absolutely
 - include paths now allows : as a separator on windows (recognising and not splitting drive names by the backslash)
 - `@import (css)` does not pull the directive above comments
 - Fix for import statements without quotes sometimes causing issues
 - replace supports dimensions and colours
 - the browser field is set in the package.json for use with browserify
 - another fix to support paths being passed as a string instead of an array
 - detached rulesets can be used as default arguments
 - Fix a lot of false warnings about extends
 - errors written to stderr more consistently
 - consistently keep units if strict units is off
 - Better support for comments in function all arguments

## 2.4.0

2015-02-07

 - Support for plugins that pre-process (to add libraries silently etc.)
 - Empty sourcemaps now work
 - Extract and Length functions now ignore comments in a list (more work to come to fix the general problem)
 - fragment urls are treated absolute since they refer to the html document
 - Extends on a selector joined with `&` now work better
 - Nested mixins work better with !important (regression in 2.3.0)
 - The promise dependency is now actually optional (introduced in 2.0.0)
 - Files with just `\r` newlines now process ok (regression in 2.0.0)
 - When strict units is off and the unit is 1/x, (e.g. 1 / 12px) the unit output is x, previously nothing (regression in 2.0.0)

## 2.3.1

2015-01-28

 - Fix depends option (regression in 2.3.0)
 - Support parent selector (`&`) used in sub element expression (e.g. `:not(.c_&)`)

## 2.3.0

2015-01-27

 - add `isruleset` function
 - add optional import option, causing less to not fail if file not found
 - Fix browsers-side cache.
 - Many fixes to import reference - support `@support` and keyframe
 - Selectors now interpolate pseudo selectors (e.g. `:@{hover}`)
 - Fix comments missed off if they were at the end of the file
 - Fix !important used with parametric mixins
 - Emits warnings for extends when the target is not found
 - include-path now works on data-uri
 - variables and function calls work for path in data-uri
 - Fix absolute paths not working on imports sometimes.
 - Unicode BOM removed again
 - Misc. bug fixes

## 2.2.0

2015-01-04

 - do not apply relative paths to svg-gradient and data-uri functions data-uri output
 - using import filename interpolation and import inline together now works
 - deprecate the compression option (still works, but outputs a warning unless silent)
 - The node version of less now has image-size, image-width, image-height which return the image dimensions of a file
 - Fixed an issue that could cause the parse to occur more than once and the callback be called multiple times
 - if you are outputting to the console, lessc defaults to silent so warnings do not end up in output
 - `isunit` function supports `''` to test if a dimension has no unit
 - data-uri function now counts characters after base64 encoding instead of bytes before encoding to determine ie8 support
 - fix bug effecting guards on pseudo class selectors
 - do not cache on the browser when used with modifyVars
 - detection if less does not parse last character in file
 - detection of whether a file is css now requires `/css`, `.css`, `?css`, `&css` instead of just `css`. You can still tell less the type of file using import options.
 - remove extra new line added to sourcemap entry inline file
 - support safari extension
 - less.parse now exposes a way to get the AST. We do not recommend you use this unless you need to.

## 2.1.2

2014-12-20

 - Fix for use with requirejs
 - Fixes for data-uri function

## 2.1.1

2014-11-27

 - Improved keyword and anonymous usage with the replace function
 - Added `getCSSAppendage` to sourcemap builder to avoid duplication in plugins
 - Fix problem with plugins when used with the promises version of render
 - If the render callback throws an exception it now propagates instead of calling the callback again with an error

## 2.1.0

2014-11-23

 - Fixed `isSync` option, it was using sync file operations but promises are guaranteed to call back async. We now support promises as a feature rather than the 1st class way of doing things.
 - Browser code is now synchronous again, like in v1, meaning it blocks the site until less is compiled
 - Some fixes for variable imports which affected filemanagers when synchronous
 - Fixed lessc makefile dependencies option
 - output now reports back a imports field with an array of imported files
 - relative path test for drive names (so windows only) is now case insensitive
 - Fix for IE7 - use getChar instead of indexing array
 - variables using !important now output !important, which bubbles up to affect the rule
 - livereload cache buster is now treated specially
 - upgrade dependencies

## 2.0.0

2014-11-09

 - Fixed multiplication in non strict units mode to take the left operand unit, in the case that the unit cannot be resolved
 - Some fixes for browser cross-compatibility
 - browser tests now pass in IE 8-11 and FF
 - added index.js and browser.js in root as shortcuts
 - fixed some local variable spellings
 - support for `@counter-style` directive

## 2.0.0-b3

2014-11-01

 - some refactoring of browser structure to allow use of api vs normal browser bundle
 - browser bundle no longer leaks require
 - browser can now be scoped with just window
 - browser `useFileCache` defaults to `true`, but file cache is now cleared when refreshing or in watch mode

## 2.0.0-b2

2014-10-26

 - Imports are now sequenced and so are consistent (previously some complex projects might end up with occasional different orderings)
 - Imports with variables are better supported - variables can be specified in sub imports
 - Support for rebeccapurple
 - Browser can now accept options as attributes on the script tag and the link tags e.g. `<script data-verbose="false" src="less.js"...`
 - adding a .less file extension is done in the abstract file manager so it the behaviour can be overridden by certain file managers
 - Fixed a bug where unquoted urls beginning `//` e.g. `url(//file/file.less)` would be incorrectly interpreted (bug introduced in b-1)
 - lessc plugins can be a function, used as a constructor as well as an object - this to allow the plugin more flexibility to be used programattically

## 2.0.0-b1

2014-10-19

 - Public Beta / Release Candidate - Feedback welcome
   For a guide to breaking changes see [the v2 upgrade guide](http://lesscss.org/usage/#v2-upgrade-guide)
 - no longer including old versions of less in the repo or npm
 - not including test less and gradle files in npm
 - colours now output in the format they are added, so yellow will output yellow, not its hex counterpart
 - better parsing - better comment support and comments in brackets can now contain comments including quotes.
 - Removal of dependency on clean-css - install less-plugin-clean-css and use --clean-css to reference plugin
 - Environment Support - less is now separate from its node and browser environment implementations and adding support for another javascript environment should be straight forward.
 - Plugin Support - it is now straight forward to add AST manipulations (see less-plugin-inline-images), file managers (see less-plugin-npm-import) and post processors (see less-plugin-clean-css and less-plugin-autoprefix).
 - We now recommend using less.render and using the parser directly is not in the same way as in v2. It is possible but it would require changes and we do not guarantee it will not be broken in minor version releases.
 - In the browser, less.pageLoadFinished will be a promise, resolved when less has finished its initial processing. less.refresh and less.modifyVars also return promises.
 - In the browser, as before less is used as options, however this is now copied to less.options if you need to access after less has run
 - In the browser, the cache can be overwritten by setting less.cache before less loads. After load less.cache will be the default implementation.
 - less.js now uses browserify to generate its browser side component
 - default values for the sourcemap options have been re-done and improved to hopefully mean creating sourcemaps is easier
 - Many smaller bugfixes and API changes. Please let us know if something you relied on has disappeared or an area should be better documented.

## 1.7.5

2014-09-03

 - Allow comments in keyframe (complete comment support coming in 2.0)
 - pass options to parser from less.render
 - Support /deep/ combinator
 - handle fragments in data-uri's
 - float @charsets to the top correctly
 - updates to some dependencies
 - Fix interpolated import in media query
 - A few other various small corrections

## 1.7.4

2014-07-27

 - Handle uppercase paths in browser
 - Show error if an empty selector is used in extend
 - Fix property merging in directives
 - Fix ordering of charset and import directives
 - Fix race condition that caused a rules is undefined error sometimes if you had a complex import strategy
 - Better error message for imports missing semi-colons or malformed
 - Do not use util.print to avoid deprecate warnings in node 0.11

## 1.7.3

2014-06-22

 - Include dist files, missing from 1.7.2
 - Do not round the results of color functions, like lightness, hue, luma etc.
 - Support cover and contain keywords in background definitions

 ## 1.7.2

2014-06-19

 - Allow paths option to be a string (in 1.7.1 less started throwing an exception instead of incorrectly processing the string as an array of chars)
 - Do not round numbers when used with javascript (introduced 1.7.0)

## 1.7.1

2014-06-08

 - Fix detection of recursive mixins
 - Fix the paths option for later versions of node (0.10+)
 - Fix paths joining bug
 - Fix a number precision issue on some versions of node
 - Fix an IE8 issue with importing css files
 - Fix IE11 detection for xhr requests
 - Modify var works if the last line of a less file is a comment.
 - Better detection of valid hex colour codes
 - Some stability fixes to support a low number of available file handles
 - Support comparing values with different quote types e.g. "test" now === 'test'
 - Give better error messages if accessing a url that returns a non 200 status code
 - Fix the e() function when passed empty string
 - Several minor bug fixes

## 1.7.0

2014-02-27

 - Add support for rulesets in variables and passed to mixins to allow wrapping
 - Change luma to follow the w3c spec, luma is available as luminance. Contrast still uses luma so you may see differences if your threshold % is close to the existing calculated luma.
 - Upgraded clean css which means the --selectors-merge-mode is now renamed --compatibility
 - Add support for using variables with @keyframes, @namespace, @charset
 - Support property merging with +_ when spaces are needed and keep + for comma separated
 - Imports now always import once consistently - a race condition meant previously certain configurations would lead to a different ordering of files
 - Fix support for `.mixin(@args...)` when called with no args (e.g. `.mixin();`)
 - Do unit conversions with min and max functions. Don't pass through if not understood, throw an error
 - Allow % to be passed on its own to the unit function e.g. `unit(10, %)`
 - Fix a bug when comparing a unit value to a non-unit value if the unit-value was the multiple of another unit (e.g. cm, mm, deg etc.)
 - Fix mixins with media queries in import reference files not being put into the output (they now output, they used to incorrectly not)
 - Fix lint mode - now reports all errors
 - Fixed a small scope issue with & {} selector rulesets incorrectly making mixins visible - regression from 1.6.2
 - Browser - added log level "debug" at 3 to get less logging, The default has changed so unless you set the value to the default you won't see a difference
 - Browser - logLevel takes effect regardless of the environment (production/dev)
 - Browser - added postProcessor option, a function called to post-process the css before adding to the page
 - Browser - use the right request for file access in IE

## 1.6.3

2014-02-08

 - Fix issue with calling toCSS twice not working in some situations (like with bootstrap 2)

## 1.6.2

2014-02-02

 - The Rhino release is fixed!
 - ability to use uppercase colours
 - Fix a nasty bug causing syntax errors when selector interpolation is preceded by a long comment (and some other cases)
 - Fix a major bug with the variable scope in guards on selectors (e.g. not mixins)
 - Fold in `& when () {` to the current selector rather than duplicating it
 - fix another issue with array prototypes
 - add a url-args option which adds a value to all urls (for cache busting)
 - Round numbers to 8 decimal places - thereby stopping javascript precision errors
 - some improvements to the default() function in more complex scenarios
 - improved missing '{' and '(' detection

## 1.6.1

2014-01-12

 - support ^ and ^^ shadow dom selectors
 - fix sourcemap selector (used to report end of the element or selector) and directive position (previously not supported)
 - fix parsing empty less files
 - error on (currently) ambiguous guards on multiple css selectors
 - older environments - protect against typeof regex returning function
 - Do not use default keyword
 - use innerHTML in tests, not innerText
 - protect for-in in case Array and Object prototypes have custom fields

## 1.6.0

2014-01-01

 - Properties can be interpolated, e.g. @{prefix}-property: value;
 - a default function has been added only valid in mixin definitions to determine if no other mixins have been matched
 - Added a plugins option that allows specifying an array of visitors run on the less AST
 - Performance improvements that may result in approx 20-40% speed up
 - Javascript evaluations returning numbers can now be used in calculations/functions
 - fixed issue when adding colours, taking the alpha over 1 and breaking when used in colour functions
 - when adding together 2 colours with non zero alpha, the alpha will now be combined rather than added
 - the advanced colour functions no longer ignore transparency, they blend that too
 - Added --clean-option and cleancssOptions to allow passing in clean css options
 - rgba declarations are now always clamped e.g. rgba(-1,258,258, -1) becomes rgba(0, 255, 255, 0)
 - Fix possible issue with import reference not bringing in styles (may not be a bugfix, just a code tidy)
 - Fix some issues with urls() being prefixed twice and unquoted urls in mixins being processed each time they are called
 - Fixed error messages for undefined variables in javascript evaluation
 - Fixed line/column numbers from math errors

## 1.5.1

2013-11-17

 - Added source-map-URL option
 - Fixed a bug which meant the minimised 1.5.0 browser version was not wrapped, meaning it interfered with require js
 - Fixed a bug where the browser version assume port was specified
 - Added the ability to specify variables on the command line
 - Upgraded clean-css and fixed it from trying to import
 - correct a bug meaning imports weren't synchronous (syncImport option available for full synchronous behaviour)
 - better mixin matching behaviour with calling multiple classes e.g. .a.b.c;

## 1.5.0

2013-10-21

 - sourcemap support
 - support for import inline option to include css that you do NOT want less to parse e.g. `@import (inline) "file.css";`
 - better support for modifyVars (refresh styles with new variables, using a file cache), is now more resiliant
 - support for import reference option to reference external css, but not output it. Any mixin calls or extend's will be output.
 - support for guards on selectors (currently only if you have a single selector)
 - allow property merging through the +: syntax
 - Added min/max functions
 - Added length function and improved extract to work with comma separated values
 - when using import multiple, sub imports are imported multiple times into final output
 - fix bad spaces between namespace operators
 - do not compress comment if it begins with an exclamation mark
 - Fix the saturate function to pass through when using the CSS syntax
 - Added svg-gradient function
 - Added no-js option to lessc (in browser, use javascriptEnabled: false) which disallows JavaScript in less files
 - switched from the little supported and buggy cssmin (previously ycssmin) to clean-css
 - support transparent as a color, but not convert between rgba(0, 0, 0, 0) and transparent
 - remove sys.puts calls to stop deprecation warnings in future node.js releases
 - Browser: added logLevel option to control logging (2 = everything, 1 = errors only, 0 = no logging)
 - Browser: added errorReporting option which can be "html" (default) or "console" or a function
 - Now uses grunt for building and testing
 - A few bug fixes for media queries, extends, scoping, compression and import once.

## 1.4.2

2013-07-20

 - if you don't pass a strict maths option, font size/line height options are output correctly again
 - npmignore now include .gitattributes
 - property names may include capital letters
 - various windows path fixes (capital letters, multiple // in a path)

## 1.4.1

2013-07-05

 - fix syncImports and yui-compress option, as they were being ignored
 - fixed several global variable leaks
 - handle getting null or undefined passed as the options object

## 1.4.0

2013-06-05

 - fix passing of strict maths option

## 1.4.0 Beta 4

2013-05-04

 - change strictMaths to strictMath. Enable this with --strict-math=on in lessc and strictMath:true in JavaScript.
 - change lessc option for strict units to --strict-units=off

## 1.4.0 Beta 3

2013-04-30

 - strictUnits now defaults to false and the true case now gives more useful but less correct results, e.g. 2px/1px = 2px
 - Process ./ when having relative paths
 - add isunit function for mixin guards and non basic units
 - extends recognise attributes
 - exception errors extend the JavaScript Error
 - remove es-5-shim as standard from the browser
 - Fix path issues with windows/linux local paths

## 1.4.0 Beta 1 & 2

2013-03-07

 - support for `:extend()` in selectors (e.g. `input:extend(.button) {}`) and `&:extend();` in ruleset (e.g. `input { &:extend(.button all); }`)
 - maths is now only done inside brackets. This means font: statements, media queries and the calc function can use a simpler format without being escaped. Disable this with --strict-maths-off in lessc and strictMaths:false in JavaScript.
 - units are calculated, e.g. 200cm+1m = 3m, 3px/1px = 3. If you use units inconsistently you will get an error. Suppress this error with --strict-units-off in lessc or strictUnits:false in JavaScript
 - `(~"@var")` selector interpolation is removed. Use @{var} in selectors to have variable selectors
 - default behaviour of import is to import each file once. `@import-once` has been removed.
 - You can specify options on imports to force it to behave as css or less `@import (less) "file.css"` will process the file as less
 - variables in mixins no longer 'leak' into their calling scope
 - added data-uri function which will inline an image into the output css. If ieCompat option is true and file is too large, it will fallback to a url()
 - significant bug fixes to our debug options
 - other parameters can be used as defaults in mixins e.g. .a(@a, @b:@a)
 - an error is shown if properties are used outside of a ruleset
 - added extract function which picks a value out of a list, e.g. extract(12 13 14, 3) => 14
 - added luma, hsvhue, hsvsaturation, hsvvalue functions
 - added pow, pi, mod, tan, sin, cos, atan, asin, acos and sqrt math functions
 - added convert function, e.g. convert(1rad, deg) => value in degrees
 - lessc makes output directories if they don't exist
 - lessc `@import` supports https and 301's
 - lessc "-depends" option for lessc writes out the list of import files used in makefile format
 - lessc "-lint" option just reports errors
 - support for namespaces in attributes and selector interpolation in attributes
 - other bug fixes

## 1.3.3

2012-12-30

 - Fix critical bug with mixin call if using multiple brackets
 - when using the filter contrast function, the function is passed through if the first argument is not a color

## 1.3.2

2012-12-28

 - browser and server url re-writing is now aligned to not re-write (previous lessc behaviour)
 - url-rewriting can be made to re-write to be relative to the entry file using the relative-urls option (less.relativeUrls option)
 - rootpath option can be used to add a base path to every url
 - Support mixin argument separator of ';' so you can pass comma separated values. e.g. `.mixin(23px, 12px;);`
 - Fix lots of problems with named arguments in corner cases, not behaving as expected
 - hsv, hsva, unit functions
 - fixed lots more bad error messages
 - fix `@import-once` to use the full path, not the relative one for determining if an import has been imported already
 - support `:not(:nth-child(3))`
 - mixin guards take units into account
 - support unicode descriptors (`U+00A1-00A9`)
 - support calling mixins with a stack when using `&` (broken in 1.3.1)
 - support `@namespace` and namespace combinators
 - when using % with colour functions, take into account a colour is out of 256
 - when doing maths with a % do not divide by 100 and keep the unit
 - allow url to contain % (e.g. %20 for a space)
 - if a mixin guard stops execution a default mixin is not required
 - units are output in strings (use the unit function if you need to get the value without unit)
 - do not infinite recurse when mixins call mixins of the same name
 - fix issue on important on mixin calls
 - fix issue with multiple comments being confused
 - tolerate multiple semi-colons on rules
 - ignore subsequant `@charset`
 - syncImport option for node.js to read files syncronously
 - write the output directory if it is missing
 - change dependency on cssmin to ycssmin
 - lessc can load files over http
 - allow calling less.watch() in non dev mode
 - don't cache in dev mode
 - less files cope with query parameters better
 - sass debug statements are now chrome compatible
 - modifyVars function added to re-render with different root variables

## 1.3.1

2012-10-18

- Support for comment and @media debugging statements
- bug fix for async access in chrome extensions
- new functions tint, shade, multiply, screen, overlay, hardlight, difference, exclusion, average, negation, softlight, red, green, blue, contrast
- allow escaped characters in attributes
- in selectors support @{a} directly, e.g. .a.@{a} { color: black; }
- add fraction parameter to round function
- much better support for & selector
- preserve order of link statements client side
- lessc has better help
- rhino version fixed
- fix bugs in clientside error handling
- support dpi, vmin, vm, dppx, dpcm units
- Fix ratios in media statements
- in mixin guards allow comparing colors and strings
- support for -*-keyframes (for -khtml but now supports any)
- in mix function, default weight to 50%
- support @import-once
- remove duplicate rules in output
- implement named parameters when calling mixins
- many numerous bug fixes

## 1.3.0

2012-03-10

- @media bubbling
- Support arbitrary entities as selectors
- [Variadic argument support](https://gist.github.com/1933613)
- Behaviour of zero-arity mixins has [changed](https://gist.github.com/1933613)
- Allow `@import` directives in any selector
- Media-query features can now be a variable
- Automatic merging of media-query conditions
- Fix global variable leaks
- Fix error message on wrong-arity call
- Fix an `@arguments` behaviour bug
- Fix `::` selector output
- Fix a bug when using @media with mixins


## 1.2.1

2012-01-15

- Fix imports in browser
- Improve error reporting in browser
- Fix Runtime error reports from imported files
- Fix `File not found` import error reporting


## 1.2.0

2012-01-07

- Mixin guards
- New function `percentage`
- New `color` function to parse hex color strings
- New type-checking stylesheet functions
- Fix Rhino support
- Fix bug in string arguments to mixin call
- Fix error reporting when index is 0
- Fix browser support in WebKit and IE
- Fix string interpolation bug when var is empty
- Support `!important` after mixin calls
- Support vanilla @keyframes directive
- Support variables in certain css selectors, like `nth-child`
- Support @media and @import features properly
- Improve @import support with media features
- Improve error reports from imported files
- Improve function call error reporting
- Improve error-reporting
