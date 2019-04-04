# URI.js - Changelog #

The release notes tracked in this document are also made available on the [releases page](https://github.com/medialize/URI.js/releases)

### 1.19.1 (February 10th 2018) ###

* fixing [`.href()`](http://medialize.github.io/URI.js/docs.html#href) to parse `query` property - [Issue #366](https://github.com/medialize/URI.js/issues/366), [PR #367](https://github.com/medialize/URI.js/issues/367)

### 1.19.0 (October 1st 2017) ###

* adding `.setFragment()` to [query fragment plugin](http://medialize.github.io/URI.js/docs.html#fragment-abuse-query) - [Issue #338](https://github.com/medialize/URI.js/issues/338), [PR #356](https://github.com/medialize/URI.js/issues/356)
* adding setting [`URI.preventInvalidHostname`](http://medialize.github.io/URI.js/docs.html#setting-preventInvalidHostname) to control if an error should be thrown on invalid input - [Issue #352](https://github.com/medialize/URI.js/issues/352), [Issue #354](https://github.com/medialize/URI.js/issues/354), [Issue #355](https://github.com/medialize/URI.js/issues/355) - effectively making the changes of version 1.18.11 opt-in rather than default.

### 1.18.12 (August 9th 2017) ###

* making [`URI.parse()`](http://medialize.github.io/URI.js/docs.html#static-parse) allow `_` in hostname - [Issue #347](https://github.com/medialize/URI.js/issues/347), [PR #348](https://github.com/medialize/URI.js/issues/348)
* fixing [`URI.parse()`](http://medialize.github.io/URI.js/docs.html#static-parse) to not use `Number.isNumber()` for IE compatibility - [Issue #350](https://github.com/medialize/URI.js/issues/350), [PR #351](https://github.com/medialize/URI.js/issues/351)

### 1.18.11 (August 8th 2017) ###

* making [`URI.parse()`](http://medialize.github.io/URI.js/docs.html#static-parse) throw on invalid port and hostname - [Issue #344](https://github.com/medialize/URI.js/issues/344), [PR #345](https://github.com/medialize/URI.js/issues/345)

### 1.18.10 (March 30th 2017) ###

* adding support for [CentralNic](https://en.wikipedia.org/wiki/CentralNic#Second-level_domains) Second Level Domains - [Issue #333](https://github.com/medialize/URI.js/issues/333)

### 1.18.9 (March 6th 2017) ###

* adding option `strict` to [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html) in order to throw an exception in case a placeholder could not be replaced - [PR #330](https://github.com/medialize/URI.js/issues/330)

### 1.18.8 (February 27th 2017) ###

* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to not resolve URIs containing a scheme - [Issue #328](https://github.com/medialize/URI.js/issues/328)

### 1.18.7 (February 13th 2017) ###

* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to ignore `www.` and `http://.` - [Issue #327](https://github.com/medialize/URI.js/issues/327)

### 1.18.6 (February 10th 2017) ###

* fixing [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html) to allow `'` (single quotes) in literals - [PR #326](https://github.com/medialize/URI.js/pull/326)

### 1.18.5 (January 30th 2017) ###

* prevent `new URI(null)` from blowing up - [PR #321](https://github.com/medialize/URI.js/issues/321)
* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to properly handle fully contained parentheses - [Issue #325](https://github.com/medialize/URI.js/issues/325)

### 1.18.4 (December 4th 2016) ###

* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to capture balanced parentheses - [Issue #247](https://github.com/medialize/URI.js/issues/247)

### 1.18.3 (November 17th 2016) ###

* fixing UMD wrappers to properly detect CommonJS - [Issue #318](https://github.com/medialize/URI.js/issues/318), [PR #319](https://github.com/medialize/URI.js/pull/319)

### 1.18.2 (September 25th 2016) ###

* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to allow callback to return `undefined` or `string` - [Issue #303](https://github.com/medialize/URI.js/issues/303)
* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to properly resolve relative paths for fragment-only URLs

### 1.18.1 (May 29th 2016) ###

* fixing UMD wrapper of `jquery.URI.js` - [Issue #295](https://github.com/medialize/URI.js/issues/295)

### 1.18.0 (April 30th 2016) ###

* adding [`URI.joinPaths()`](http://medialize.github.io/URI.js/docs.html#static-joinPaths) to compose paths from directory tokens - [Issue #285](https://github.com/medialize/URI.js/issues/285)
* fixing [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html) to allow `.` in variable names - [PR #287](https://github.com/medialize/URI.js/pull/287)
* fixing [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html) to reject invalid literals - [PR #289](https://github.com/medialize/URI.js/pull/289)
* fixing [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html) to reject prefix modifier on composite values - [PR #290](https://github.com/medialize/URI.js/pull/290)
* fixing [`URI.buildUserinfo()`](http://medialize.github.io/URI.js/docs.html#static-buildUserinfo) to properly serialize password-only values - [PR #293](https://github.com/medialize/URI.js/pull/293)

### 1.17.1 (February 25th 2016) ###

* fixing [`.normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to properly handle percent-encoded dot segments and leading dots in basename - [Issue #264](https://github.com/medialize/URI.js/issues/264), by [JordanMilne](https://github.com/JordanMilne)
* fixing [`.hasQuery()`](http://medialize.github.io/URI.js/docs.html#search-has) to accept `RegExp` for name argument - [Issue #274](https://github.com/medialize/URI.js/issues/274), [Issue #277](https://github.com/medialize/URI.js/issues/277) by [mbrodala](https://github.com/mbrodala)

### 1.17.0 (November 13th 2015) ###

* fixing [`URI.removeQuery()`](http://medialize.github.io/URI.js/docs.html#search-remove) to cast values to string before matching - [Issue #250](https://github.com/medialize/URI.js/pull/250), [Issue #252](https://github.com/medialize/URI.js/pull/252), by [ryanelian](https://github.com/ryanelian) and [Siltaar](https://github.com/Siltaar)
* fixing [`.segment()`](http://medialize.github.io/URI.js/docs.html#accessors-segment) to allow appending an empty element - [Issue #236](https://github.com/medialize/URI.js/issues/236), [Issue #253](https://github.com/medialize/URI.js/pull/253), by [orlando](https://github.com/orlando)
* adding [`.origin()`](http://medialize.github.io/URI.js/docs.html#accessors-origin) to get protocol and authority, counter-part to `.resource()` - [Issue #210](https://github.com/medialize/URI.js/issues/210), [Issue #263](https://github.com/medialize/URI.js/pull/263), by [justinmchase](https://github.com/justinmchase)

### 1.16.1 (September 19th 2015) ###

Package Management Cleanup - no changes to source code!

* renaming package to "urijs", was "URIjs" (because npm decided to go lower-case at some point and maintaining capitals in your package name poses all sorts of stupid issues)
* removing [jam](http://jamjs.org/), [spm](http://spmjs.org/), `component.json` and `URI.jquery.json` as nobody cared that URI.js was stuck on 1.14 for a year

### 1.16.0 (July 24th 2015) ###

* **SECURITY** fixing [`URI.parseHost()`](http://medialize.github.io/URI.js/docs.html#static-parseHost) to rewrite `\` to `/` as Node and Browsers do - [Issue #233](https://github.com/medialize/URI.js/pull/233)
* fixing [`.host()`](http://medialize.github.io/URI.js/docs.html#accessors-host) and [`.authority()`](http://medialize.github.io/URI.js/docs.html#accessors-authority) to raise an error if they contain a path segment (extending [Issue #233](https://github.com/medialize/URI.js/pull/233))

### 1.15.2 (July 2nd 2015) ###

* fixing [`URI.parseQuery()`](http://medialize.github.io/URI.js/docs.html#static-parseQuery) to accept `?foo&foo=bar` - [Issue #220](https://github.com/medialize/URI.js/issues/220)
* fixing [`.segmentCoded()`](http://medialize.github.io/URI.js/docs.html#accessors-segmentCoded) to encode (instead of decode) array input - [Issue #223](https://github.com/medialize/URI.js/issues/223)
* fixing [`.normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to properly resolve `/foo/..` to `/` - [Issue #224](https://github.com/medialize/URI.js/issues/224)
* fixing [`.relativeTo()`](http://medialize.github.io/URI.js/docs.html#relativeto) to resolve `/foo/` and `/foo/bar` to `./` instead of empty string - [Issue #226](https://github.com/medialize/URI.js/issues/226)
* fixing `bower.json`'s `"main": "src/URI.js"` - [Issue #227](https://github.com/medialize/URI.js/issues/227)

### 1.15.1 (April 5th 2015) ###

* fixing `URI()` to match behavior of `new URI()` (caused by [#196](https://github.com/medialize/URI.js/issues/196)) - [Issue #205](https://github.com/medialize/URI.js/issues/205)
* fixing [`URI.removeQuery()`](http://medialize.github.io/URI.js/docs.html#search-remove) to accept RegExp for name and value arguments - ([Issue #204](https://github.com/medialize/URI.js/issues/204), [peterwillis](https://github.com/peterwillis))

### 1.15.0 (April 1st 2015 - no joke, promise!) ###

* fixing `URI(undefined)` to throw TypeError - ([Issue #189](https://github.com/medialize/URI.js/issues/189), [Issue #196](https://github.com/medialize/URI.js/issues/196), [eakron](https://github.com/eakron)) - *tiny backward-compatibility-break*
* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) - ([Issue #200](https://github.com/medialize/URI.js/issues/200), [giltayar](https://github.com/giltayar))
* fixing [`.pathname()`](http://medialize.github.io/URI.js/docs.html#accessors-pathname) to properly en/decode URN paths - ([Issue #201](https://github.com/medialize/URI.js/pull/201), [mlefoster](https://github.com/mlefoster))
* fixing URI normalization to properly handle URN paths based on [RFC 2141](https://www.ietf.org/rfc/rfc2141.txt) syntax - ([Issue #201](https://github.com/medialize/URI.js/pull/201), [mlefoster](https://github.com/mlefoster))
  * fixing [`.normalize()`](http://medialize.github.io/URI.js/docs.html#normalize) and [`.normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to properly normalize URN paths
  * adding `URI.encodeUrnPathSegment()`
  * adding `URI.decodeUrnPathSegment()`
  * adding `URI.decodeUrnPath()`
  * adding `URI.recodeUrnPath()`

### 1.14.2 (February 25th 2015) ###

* fixing inclusion of LICENSE in packages - ([Issue #174](https://github.com/medialize/URI.js/issues/174))
* fixing [`URI.parseHost()`](http://medialize.github.io/URI.js/docs.html#static-parseHost) to not interpret colon in path as IPv6 hostname - ([Issue #190](https://github.com/medialize/URI.js/issues/190))
* adding meta data for [SPM](http://www.spmjs.io/) package manager - ([Issue #176](https://github.com/medialize/URI.js/issues/176))
* adding license meta to `bower.json`

### 1.14.1 (October 1st 2014) ###

* fixing handling of String instances (not string primitives) - ([Issue #146](https://github.com/medialize/URI.js/issues/146))
* fixing Firefox [`.watch()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/watch) interfering with `.parseQuery()` - ([Issue #169](https://github.com/medialize/URI.js/issues/169))
* fixing [`addQuery()`](http://medialize.github.io/URI.js/docs.html#search-add) to not throw error on null value - ([Issue #171](https://github.com/medialize/URI.js/issues/171))

### 1.14.0 (September 8th 2014) ###

* adding Hungarian second level domains - ([Issue #159](https://github.com/medialize/URI.js/issues/159))
* adding `<audio src="…">` and `<video src="…">` to supported DOM attributes - ([Issue #160](https://github.com/medialize/URI.js/issues/160)), ([Issue #161](https://github.com/medialize/URI.js/issues/161))
* fixing `file://hostname/path` parsing - ([Issue #158](https://github.com/medialize/URI.js/issues/158))
* fixing `.decodePathSegment()` to not throw malformed URI error - ([Issue #163](https://github.com/medialize/URI.js/issues/163))

### 1.13.2 (May 29th 2014) ###

* changes to package management manifests only

### 1.13.1 (April 16th 2014) ###

* fixing IPv6 normalization (bad variable name) - ([Issue #145](https://github.com/medialize/URI.js/issues/145))
* adding grunt and jshint
* changing code style to 2 spaces indentation, single quote strings
* applying `'use strict';` everywhere
* fixing jshint warnings

### 1.13.0 (April 15th 2014) ###

* fixing [`URI.parseHost()`](http://medialize.github.io/URI.js/docs.html#static-parseHost) and [`URI.buildHost()`](http://medialize.github.io/URI.js/docs.html#static-buildHost) to properly parse and build the IPv6 examples given in [RFC2732 Format for Literal IPv6 Addresses in URL's](http://tools.ietf.org/html/rfc2732#section-2) - ([Issue #144](https://github.com/medialize/URI.js/issues/144))
* adding performance improvements to SecondLevelDomain - ([PR #122](https://github.com/medialize/URI.js/pull/122), [gorhill](https://github.com/gorhill))

### 1.12.1 (March 8th 2014) ###

* fixing [`.encodeQuery()`](http://medialize.github.io/URI.js/docs.html#static-encodeQuery) and [`.decodeQuery()`](http://medialize.github.io/URI.js/docs.html#static-decodeQuery) to respect [`URI.escapeQuerySpace`](http://medialize.github.io/URI.js/docs.html#setting-escapeQuerySpace) - ([Issue #137](https://github.com/medialize/URI.js/issues/137))
* fixing fragment plugins to return URI for simpler loading - ([Issue #139](https://github.com/medialize/URI.js/issues/139))

### 1.12.0 (January 23rd 2014) ###

* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to comply with [RFC3986 Reference Resolution Examples](http://tools.ietf.org/html/rfc3986#section-5.4) - ([Issue #113](https://github.com/medialize/URI.js/issues/113))
* fixing [`.normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to maintain leading parent references (`../`) for relative paths, while removing them for absolute paths - ([Issue #133](https://github.com/medialize/URI.js/issues/133))
* fixing `URI.protocol_expression` to properly accept `.` in compliance with [RFC 3986 - Scheme](http://tools.ietf.org/html/rfc3986#section-3.1) - ([Issue #132](https://github.com/medialize/URI.js/issues/132))
* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to not use backtracking prone regular expression `URI.find_uri_expression` anymore - ([Issue #131](https://github.com/medialize/URI.js/issues/131))
* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to accept options `ignore` and `ignoreHtml` to allow better control over which detected URLs get handled - ([Issue #117](https://github.com/medialize/URI.js/issues/117))
* fixing [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString) to accept option `start` to specify the RegExp used for finding the beginning of an URL (defaults to `/\b(?:([a-z][a-z0-9.+-]*:\/\/)|www\.)/gi`) - ([Issue #115](https://github.com/medialize/URI.js/issues/115))

### 1.11.2 (August 14th 2013) ###

* fixing regression for Node.js introduced by `fixing unsafe eval by using UMD's root` - ([Issue #107](https://github.com/medialize/URI.js/issues/107))
* fixing parser to accept malformed userinfo (non-encoded email address) - ([Issue #108](https://github.com/medialize/URI.js/issues/108))

### 1.11.1 (August 13th 2013) ###

* fixing inconsistent [`.relativeTo()`](http://medialize.github.io/URI.js/docs.html#relativeto) results caused by inconsistent URI component handling - ([Issue #103](https://github.com/medialize/URI.js/issues/103))
* fixing unsafe eval by using UMD's root - ([Issue #105](https://github.com/medialize/URI.js/issues/105))
* fixing [`.segment()`](http://medialize.github.io/URI.js/docs.html#accessors-segment) to allow appending an empty element - ([Issue #106](https://github.com/medialize/URI.js/issues/106))
* fixing [`.segment()`](http://medialize.github.io/URI.js/docs.html#accessors-segment) to collapse empty elements in array notation

### 1.11.0 (August 6th 2013) ###

* adding [`.segmentCoded()`](http://medialize.github.io/URI.js/docs.html#accessors-segmentCoded) to provide en/decoding interface to `.segment()` - ([Issue #79](https://github.com/medialize/URI.js/issues/79))
* optimize [`.relativeTo()`](http://medialize.github.io/URI.js/docs.html#relativeto) results - ([Issue #78](https://github.com/medialize/URI.js/issues/78), [Issue #95](https://github.com/medialize/URI.js/issues/95))
* removing obsolete code fragments from `URI.parse()` and `relativeTo()` - ([Issue #100](https://github.com/medialize/URI.js/issues/100))
* adding setting [`URI.escapeQuerySpace`](http://medialize.github.io/URI.js/docs.html#setting-escapeQuerySpace) to control if query string should escape spaces using `+` or `%20` - ([Issue #74](https://github.com/medialize/URI.js/issues/74))
* updating [Punycode.js](https://github.com/bestiejs/punycode.js/) to version 1.2.3
* fixing internal `strictEncodeURIComponent()` to work in Firefox 3.6 - ([Issue #91](https://github.com/medialize/URI.js/issues/91))
* fixing [`.normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to properly resolve `/.` and `/.//` to `/` - ([Issue #97](https://github.com/medialize/URI.js/issues/97))
* fixing [`.path()`](http://medialize.github.io/URI.js/docs.html#accessors-pathname) to return empty string if there is no path - ([Issue #82](https://github.com/medialize/URI.js/issues/82))
* fixing crashing of `URI.decodeQuery()` on malformed input - now returns original undecoded data - ([Issue #87](https://github.com/medialize/URI.js/issues/87), [Issue #92](https://github.com/medialize/URI.js/issues/92))
* fixing build tool - ([Issue #83](https://github.com/medialize/URI.js/issues/83))
* fixing for-loop to make closure compiler happy - ([Issue #93](https://github.com/medialize/URI.js/issues/93))
* adding [`URI.noConflict()`](http://medialize.github.io/URI.js/docs.html#static-noConflict) - ([Issue #84](https://github.com/medialize/URI.js/issue/84))
* fixing whitespace in code - ([Issue #84](https://github.com/medialize/URI.js/issue/84))
* fixing [`.readable()`](http://medialize.github.io/URI.js/docs.html#readable) to decode the hash value as well - ([Issue #90](https://github.com/medialize/URI.js/issue/90))
* prevent `jquery.URI.js` from temporarily using `window.location` as the `href` of an empty attribute of a DOM element - ([Issue #94](https://github.com/medialize/URI.js/issues/94))
* fixing internal `getType()` for IE8 with undefined value - ([Issue #96](https://github.com/medialize/URI.js/issues/96))
* adding DOM elements to [URI constructor](http://medialize.github.io/URI.js/docs.html#constructor) - ([Issue #77](https://github.com/medialize/URI.js/issues/77)):
  * [`<a href="...">`](http://www.w3.org/html/wg/drafts/html/master/text-level-semantics.html#the-a-element)
  * [`<blockquote cite="...">`](http://www.w3.org/html/wg/drafts/html/master/grouping-content.html#the-blockquote-element)
  * [`<link href="...">`](http://www.w3.org/html/wg/drafts/html/master/document-metadata.html#the-link-element)
  * [`<base href="...">`](http://www.w3.org/html/wg/drafts/html/master/document-metadata.html#the-base-element)
  * [`<script src="...">`](http://www.w3.org/html/wg/drafts/html/master/scripting-1.html#script)
  * [`<form action="...">`](http://www.w3.org/html/wg/drafts/html/master/forms.html#the-form-element)
  * [`<input type="image" src="...">`](http://www.w3.org/html/wg/drafts/html/master/forms.html#the-input-element)
  * [`<img src="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-img-element)
  * [`<area href="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-area-element)
  * [`<iframe src="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-iframe-element)
  * [`<embed src="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-embed-element)
  * [`<source src="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-source-element)
  * [`<track src="...">`](http://www.w3.org/html/wg/drafts/html/master/embedded-content-0.html#the-track-element)
* optimize `jquery.URI.js` to use new DOM element infrastructure

### 1.10.2 (April 15th 2013) ###

* fixing [`relativeTo()`](http://medialize.github.io/URI.js/docs.html#relativeto) - ([Issue #75](https://github.com/medialize/URI.js/issues/75))
* fixing [`normalizePath()`](http://medialize.github.io/URI.js/docs.html#normalize-path) to not prepend `./` to relative paths - ([Issue #76](https://github.com/medialize/URI.js/issues/76))

### 1.10.1 (April 2nd 2013) ###

* adding [`absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to properly resolve relative scheme - ([Issue #71](https://github.com/medialize/URI.js/issues/73))

### 1.10.0 (March 16th 2013) ###

* adding [`hasQuery()`](http://medialize.github.io/URI.js/docs.html#search-has) - ([Issue #71](https://github.com/medialize/URI.js/issues/71))
* fixing URI property detection to return 'src' if none was detected (`jquery.URI.js`) - ([Issue #69](https://github.com/medialize/URI.js/issues/69))

### 1.9.1 (February 12th 2013) ###

* fixing IE9 compatibility with location import: `URI(location)`
* fixing string character access for IE7 - ([Issue #67](https://github.com/medialize/URI.js/issues/67)), ([Issue #68](https://github.com/medialize/URI.js/issues/68))

### 1.9.0 (February 11th 2013) ###

* adding [`.setQuery()`](http://medialize.github.io/URI.js/docs.html#search-set) - ([Issue #64](https://github.com/medialize/URI.js/issues/64))
* adding callback argument to [`.query()`](http://medialize.github.io/URI.js/docs.html#accessors-search)
* adding jQuery 1.9.1 to the test suite

### 1.8.3 (January 9th 2013) ###

* fixing [UglifyJS2](https://github.com/mishoo/UglifyJS2) compression - ([Issue #60](https://github.com/medialize/URI.js/issues/60), [fidian](https://github.com/fidian))

### 1.8.2 (December 27th 2012) ###

* adding `.fragmentPrefix()` to configure prefix of fragmentURI and fragmentQuery extensions - ([Issue #55](https://github.com/medialize/URI.js/issues/55))
* adding docs for [`.toString()`, `.valueOf()`](http://medialize.github.io/URI.js/docs.html#toString) and [`.href()`](http://medialize.github.io/URI.js/docs.html#href) - ([Issue #56](https://github.com/medialize/URI.js/issues/56))
* fixing [`.relativeTo()`](http://medialize.github.io/URI.js/docs.html#relativeto) for descendants - ([Issue #57](https://github.com/medialize/URI.js/issues/57))

### 1.8.1 (November 15th 2012) ###

* fixing build() to properly omit empty query and fragment ([Issue #53](https://github.com/medialize/URI.js/issues/53))

### 1.8.0 (November 13th 2012) ###

* adding [`.resource()`](http://medialize.github.io/URI.js/docs.html#accessors-resource) as compound of [path, query, fragment]
* adding jQuery 1.8.x compatibility for jQuery.URI.js (remaining backwards compatibility!)
* adding default ports for gopher, ws, wss
* adding [`.duplicateQueryParameters()`](http://medialize.github.io/URI.js/docs.html#setting-duplicateQueryParameters) to control if `key=value` duplicates have to be preserved or reduced ([Issue #51](https://github.com/medialize/URI.js/issues/51))
* updating [Punycode.js](https://github.com/bestiejs/punycode.js/) to version 1.1.1
* improving AMD/Node using [UMD returnExports](https://github.com/umdjs/umd/blob/master/returnExports.js) - ([Issue #44](https://github.com/medialize/URI.js/issues/44), [Issue #47](https://github.com/medialize/URI.js/issues/47))
* fixing `.addQuery("empty")` to properly add `?empty` - ([Issue #46](https://github.com/medialize/URI.js/issues/46))
* fixing parsing of badly formatted userinfo `http://username:pass:word@hostname`
* fixing parsing of Windows-Drive-Letter paths `file://C:/WINDOWS/foo.txt`
* fixing `URI(location)` to properly parse the URL - ([Issue #52](https://github.com/medialize/URI.js/issues/52))
* fixing type error for fragment abuse demos - ([Issue #50](https://github.com/medialize/URI.js/issues/50))
* adding documentation for various [encode/decode functions](http://medialize.github.io/URI.js/docs.html#encoding-decoding)
* adding some pointers on possible problems with URLs to [About URIs](http://medialize.github.io/URI.js/about-uris.html)
* adding tests for fragment abuse and splitting tests into separate scopes
* adding meta-data for [Jam](http://jamjs.org/) and [Bower](http://twitter.github.com/bower/)

Note: QUnit seems to be having some difficulties on IE8. While the jQuery-plugin tests fail, the plugin itself works. We're still trying to figure out what's making QUnit "lose its config state".

### 1.7.4 (October 21st 2012) ###

* fixing parsing of `/wiki/Help:IPA` - ([Issue #49](https://github.com/medialize/URI.js/issues/49))

### 1.7.3 (October 11th 2012) ###

* fixing `strictEncodeURIComponent()` to properly encode `*` to `%2A`
* fixing IE9's incorrect report of `img.href` being available - ([Issue #48](https://github.com/medialize/URI.js/issues/48))

### 1.7.2 (August 28th 2012) ###

* fixing SLD detection in [`.tld()`](http://medialize.github.io/URI.js/docs.html#accessors-tld) - `foot.se` would detect `t.se` - ([Issue #42](https://github.com/medialize/URI.js/issues/42))
* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to comply with [RFC 3986 Section 5.2.2](http://tools.ietf.org/html/rfc3986#section-5.2.2) - ([Issue #41](https://github.com/medialize/URI.js/issues/41))
* fixing `location` not being available in non-browser environments like node.js ([Issue #45](https://github.com/medialize/URI.js/issues/45) [grimen](https://github.com/grimen))

### 1.7.1 (August 14th 2012) ###

* fixing [`.segment()`](http://medialize.github.io/URI.js/docs.html#accessors-segment)'s append operation - ([Issue #39](https://github.com/medialize/URI.js/issues/39))

### 1.7.0 (August 11th 2012) ###

* fixing URI() constructor passing of `base` - ([Issue #33](https://github.com/medialize/URI.js/issues/33) [LarryBattle](https://github.com/LarryBattle))
* adding [`.segment()`](http://medialize.github.io/URI.js/docs.html#accessors-segment) accessor - ([Issue #34](https://github.com/medialize/URI.js/issues/34))
* upgrading `URI.encode()` to strict URI encoding according to RFC3986
* adding `URI.encodeReserved()` to exclude reserved characters (according to RFC3986) from being encoded
* adding [URI Template (RFC 6570)](http://tools.ietf.org/html/rfc6570) support with [`URITemplate()`](http://medialize.github.io/URI.js/uri-template.html)

### 1.6.3 (June 24th 2012) ###

* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to join two relative paths properly - ([Issue #29](https://github.com/medialize/URI.js/issues/29))
* adding [`.clone()`](http://medialize.github.io/URI.js/docs.html#clone) to copy an URI instance

### 1.6.2 (June 23rd 2012) ###

* [`.directory()`](http://medialize.github.io/URI.js/docs.html#accessors-directory) now returns empty string if there is no directory
* fixing [`.absoluteTo()`](http://medialize.github.io/URI.js/docs.html#absoluteto) to join two relative paths properly - ([Issue #29](https://github.com/medialize/URI.js/issues/29))

### 1.6.1 (May 19th 2012) ###

* fixing TypeError on [`.domain()`](http://medialize.github.io/URI.js/docs.html#accessors-domain) with dot-less hostnames - ([Issue #27](https://github.com/medialize/URI.js/issues/27))

### 1.6.0 (March 19th 2012) ###

* adding [URN](http://tools.ietf.org/html/rfc3986#section-3) (`javascript:`, `mailto:`, ...) support
* adding [`.scheme()`](http://medialize.github.io/URI.js/docs.html#accessors-protocol) as alias of [`.protocol()`](http://medialize.github.io/URI.js/docs.html#accessors-protocol)
* adding [`.userinfo()`](http://medialize.github.io/URI.js/docs.html#accessors-userinfo) to comply with terminology of [RFC 3986](http://tools.ietf.org/html/rfc3986#section-3.2.1)
* adding [jQuery Plugin](http://medialize.github.io/URI.js/jquery-uri-plugin.html) `src/jquery.URI.js`
* fixing relative scheme URLs - ([Issue #19](https://github.com/medialize/URI.js/issues/19) [byroot](https://github.com/byroot))

### 1.5.0 (February 19th 2012) ###

* adding Second Level Domain (SLD) Support - ([Issue #17](https://github.com/medialize/URI.js/issues/17))

### 1.4.3 (January 28th 2012) ###

* fixing global scope leakage - ([Issue #15](https://github.com/medialize/URI.js/issues/15) [mark-rushakoff](https://github.com/mark-rushakoff))

### 1.4.2 (January 25th 2012) ###

* improving CommonJS compatibility - ([Issue #14](https://github.com/medialize/URI.js/issues/14) [FGRibreau](https://github.com/FGRibreau))

### 1.4.1 (January 21st 2012) ###

* adding CommonJS compatibility - ([Issue #11](https://github.com/medialize/URI.js/issues/11), [Evangenieur](https://github.com/Evangenieur))

### 1.4.0 (January 12th 2012) ###

* adding [`URI.iso8859()`](http://medialize.github.io/URI.js/docs.html#static-iso8859) and [`URI.unicode()`](http://medialize.github.io/URI.js/docs.html#static-unicode) to switch base charsets - ([Issue #10](https://github.com/medialize/URI.js/issues/10), [mortenn](https://github.com/))
* adding [`.iso8859()`](http://medialize.github.io/URI.js/docs.html#iso8859) and [`.unicode()`](http://medialize.github.io/URI.js/docs.html#unicode) to convert an URI's escape encoding

### 1.3.1 (January 3rd 2011) ###

* updating Punycode.js to version 0.3.0
* adding edge-case tests ("jim")
* fixing edge-cases in .protocol(), .port(), .subdomain(), .domain(), .tld(), .filename()
* fixing parsing of hostname in [`.hostname()`](http://medialize.github.io/URI.js/docs.html#accessors-hostname)

### 1.3.0 (December 30th 2011) ###

* adding [`.subdomain()`](http://medialize.github.io/URI.js/docs.html#accessors-subdomain) convenience accessor
* improving internal deferred build handling
* fixing thrown Error for `URI("http://example.org").query(true)` - ([Issue #6](https://github.com/medialize/URI.js/issues/6))
* adding examples for extending URI.js for [fragment abuse](http://medialize.github.io/URI.js/docs.html#fragment-abuse), see src/URI.fragmentQuery.js and src/URI.fragmentURI.js - ([Issue #2](https://github.com/medialize/URI.js/issues/2))

### 1.2.0 (December 29th 2011) ###

* adding [`.equals()`](http://medialize.github.io/URI.js/docs.html#equals) for URL comparison
* fixing encoding/decoding for [`.pathname()`](http://medialize.github.io/URI.js/docs.html#accessors-pathname), [`.directory()`](http://medialize.github.io/URI.js/docs.html#accessors-directory), [`.filename()`](http://medialize.github.io/URI.js/docs.html#accessors-filename) and [`.suffix()`](http://medialize.github.io/URI.js/docs.html#accessors-suffix) according to [RFC 3986 3.3](http://tools.ietf.org/html/rfc3986#section-3.3)
* fixing escape spaces in query strings with `+` according to [application/x-www-form-urlencoded](http://www.w3.org/TR/REC-html40/interact/forms.html#form-content-type)
* fixing to allow [`URI.buildQuery()`](http://medialize.github.io/URI.js/docs.html#static-buildQuery) to build duplicate key=value combinations
* fixing [`URI(string, string)`](http://medialize.github.io/URI.js/docs.html#constructor) constructor to conform with the [specification](http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#constructor)
* adding [`.readable()`](http://medialize.github.io/URI.js/docs.html#readable) for humanly readable representation of encoded URIs
* fixing bug where @ in pathname would be parsed as part of the authority

### 1.1.0 (December 28th 2011) ###

* adding [`URI.withinString()`](http://medialize.github.io/URI.js/docs.html#static-withinString)
* adding [`.normalizeProtocol()`](http://medialize.github.io/URI.js/docs.html#normalize-protocol) to lowercase protocols
* fixing [`.normalizeHostname()`](http://medialize.github.io/URI.js/docs.html#normalize-host) to lowercase hostnames
* fixing String.substr() to be replaced by String.substring() - ([Issue #1](https://github.com/medialize/URI.js/issues/1))
* fixing parsing "?foo" to `{foo: null}` [Algorithm for collecting URL parameters](http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#collect-url-parameters)
* fixing building `{foo: null, bar: ""}` to "?foo&bar=" [Algorithm for serializing URL parameters](http://dvcs.w3.org/hg/url/raw-file/tip/Overview.html#url-parameter-serialization)
* fixing RegExp escaping

### 1.0.0 (December 27th 2011) ###

* Initial URI.js
