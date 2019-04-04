# DOMPurify

[![Bower version](https://badge.fury.io/bo/dompurify.svg)](http://badge.fury.io/bo/dompurify) · [![npm version](https://badge.fury.io/js/dompurify.svg)](http://badge.fury.io/js/dompurify) · [![Build Status](https://travis-ci.org/cure53/DOMPurify.svg)](https://travis-ci.org/cure53/DOMPurify) · [![Downloads](https://img.shields.io/npm/dm/dompurify.svg)](https://www.npmjs.com/package/dompurify) · [![gzip size](http://img.badgesize.io/https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js?compression=gzip)](https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js) · [![install size](https://badgen.net/packagephobia/install/dompurify)](https://packagephobia.now.sh/result?p=dompurify)

[![NPM](https://nodei.co/npm/dompurify.png)](https://nodei.co/npm/dompurify/)

DOMPurify is a DOM-only, super-fast, uber-tolerant XSS sanitizer for HTML, MathML and SVG.

It's also very simple to use and get started with. DOMPurify was [started in February 2014](https://github.com/cure53/DOMPurify/commit/a630922616927373485e0e787ab19e73e3691b2b) and, meanwhile, has reached version 1.0.8.

DOMPurify is written in JavaScript and works in all modern browsers (Safari, Opera (15+), Internet Explorer (10+), Edge, Firefox and Chrome - as well as almost anything else using Blink or WebKit). It doesn't break on MSIE6 or other legacy browsers. It either uses [a fall-back](#what-about-older-browsers-like-msie8) or simply does nothing.

Our automated tests cover [21 different browsers](https://github.com/cure53/DOMPurify/blob/master/test/karma.custom-launchers.config.js#L5) right now, more to come. We also cover Node.js v6.0.0, v8.0.0, v9.0.0 and v10.0.0, running DOMPurify on [jsdom](https://github.com/tmpvar/jsdom).

DOMPurify is written by security people who have vast background in web attacks and XSS. Fear not. For more details please also read about our [Security Goals & Threat Model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-&-Threat-Model). Please, read it. Like, really.

## What does it do?

DOMPurify sanitizes HTML and prevents XSS attacks. You can feed DOMPurify with string full of dirty HTML and it will return a string with clean HTML. DOMPurify will strip out everything that contains dangerous HTML and thereby prevent XSS attacks and other nastiness. It's also damn bloody fast. We use the technologies the browser provides and turn them into an XSS filter. The faster your browser, the faster DOMPurify will be.

## How do I use it?

It's easy. Just include DOMPurify on your website.

### Using the unminified development version

```html
<script type="text/javascript" src="src/purify.js"></script>
```

### Using the minified and tested production version (source-map available)

```html
<script type="text/javascript" src="dist/purify.min.js"></script>
```

Afterwards you can sanitize strings by executing the following code:

```javascript
var clean = DOMPurify.sanitize(dirty);
```

The resulting HTML can be written into a DOM element using `innerHTML` or the DOM using `document.write()`. That is fully up to you. But keep in mind, if you use the sanitized HTML with jQuery's very insecure `elm.html()` method, then the `SAFE_FOR_JQUERY` flag has to be set to make sure it's safe! Other than that, all is fine.

After sanitizing your markup, you can also have a look at the property `DOMPurify.removed` and find out, what elements and attributes were thrown out.

If you're using an [AMD](https://github.com/amdjs/amdjs-api/wiki/AMD) module loader like [Require.js](http://requirejs.org/), you can load this script asynchronously as well:

```javascript
require(['dompurify'], function(DOMPurify) {
    var clean = DOMPurify.sanitize(dirty);
});
```

DOMPurify also works server-side with node.js as well as client-side via [Browserify](http://browserify.org/) or similar translators.  Node.js 0.x is not supported; either [io.js](https://iojs.org) or Node.js 4.x or newer is required.

```bash
npm install dompurify
```
For JSDOM v10 or newer
```javascript
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = (new JSDOM('')).window;
const DOMPurify = createDOMPurify(window);

const clean = DOMPurify.sanitize(dirty);
```

For JSDOM versions older than v10
```javascript
const createDOMPurify = require('dompurify');
const jsdom = require('jsdom').jsdom;

const window = jsdom('').defaultView;
const DOMPurify = createDOMPurify(window);

const clean = DOMPurify.sanitize(dirty);
```

## Is there a demo?

Of course there is a demo! [Play with DOMPurify](https://cure53.de/purify)

## What if I find a bypass?

If that happens, you probably qualify for a juicy bug bounty! The fine folks over at [FastMail](https://www.fastmail.com/) use DOMPurify for their services and added our library to their bug bounty scope. So, if you find a way to bypass or weaken DOMPurify, please have a look at their website and the [bug bounty info](https://www.fastmail.com/about/bugbounty.html).

## Some purification samples please?

How does purified markup look like? Well, [the demo](https://cure53.de/purify) shows it for a big bunch of nasty elements. But let's also show some smaller examples!

```javascript
DOMPurify.sanitize('<img src=x onerror=alert(1)//>'); // becomes <img src="x">
DOMPurify.sanitize('<svg><g/onload=alert(2)//<p>'); // becomes <svg><g></g></svg>
DOMPurify.sanitize('<p>abc<iframe/\/src=jAva&Tab;script:alert(3)>def'); // becomes <p>abcdef</p>
DOMPurify.sanitize('<math><mi//xlink:href="data:x,<script>alert(4)</script>">'); // becomes <math><mi></mi></math>
DOMPurify.sanitize('<TABLE><tr><td>HELLO</tr></TABL>'); // becomes <table><tbody><tr><td>HELLO</td></tr></tbody></table>
DOMPurify.sanitize('<UL><li><A HREF=//google.com>click</UL>'); // becomes <ul><li><a href="//google.com">click</a></li></ul>
```

## What is supported?

DOMPurify currently supports HTML5, SVG and MathML. DOMPurify per default allows CSS, HTML custom data attributes. DOMPurify also supports the Shadow DOM - and sanitizes DOM templates recursively. DOMPurify also allows you to sanitize HTML for being used with the jQuery `$()` and `elm.html()` methods but requires the `SAFE_FOR_JQUERY` flag for that - see below.

## What about older browsers like MSIE8?

DOMPurify offers a fall-back behavior for older MSIE browsers. It uses the MSIE-only `toStaticHTML` feature to sanitize. Note however that in this fall-back mode, pretty much none of the configuration flags shown below have any effect. You need to handle that yourself.

If not even `toStaticHTML` is supported, DOMPurify does nothing at all. It simply returns exactly the string that you fed it.

## Can I configure it?

Yes. The included default configuration values are pretty good already - but you can of course override them. Check out the [`/demos`](https://github.com/cure53/DOMPurify/tree/master/demos) folder to see a bunch of examples on how you can [customize DOMPurify](https://github.com/cure53/DOMPurify/tree/master/demos#what-is-this).

```javascript
// make output safe for usage in jQuery's $()/html() method (default is false)
var clean = DOMPurify.sanitize(dirty, {SAFE_FOR_JQUERY: true});

// strip {{ ... }} and <% ... %> to make output safe for template systems
var clean = DOMPurify.sanitize(dirty, {SAFE_FOR_TEMPLATES: true});

// allow only <b>
var clean = DOMPurify.sanitize(dirty, {ALLOWED_TAGS: ['b']});

// allow only <b> and <q> with style attributes (for whatever reason)
var clean = DOMPurify.sanitize(dirty, {ALLOWED_TAGS: ['b', 'q'], ALLOWED_ATTR: ['style']});

// allow all safe HTML elements but neither SVG nor MathML
var clean = DOMPurify.sanitize(dirty, {USE_PROFILES: {html: true}});

// allow all safe SVG elements and SVG Filters
var clean = DOMPurify.sanitize(dirty, {USE_PROFILES: {svg: true, svgFilters: true}});

// allow all safe MathML elements and SVG
var clean = DOMPurify.sanitize(dirty, {USE_PROFILES: {mathMl: true, svg: true}});

// leave all as it is but forbid <style>
var clean = DOMPurify.sanitize(dirty, {FORBID_TAGS: ['style']});

// leave all as it is but forbid style attributes
var clean = DOMPurify.sanitize(dirty, {FORBID_ATTR: ['style']});

// extend the existing array of allowed tags
var clean = DOMPurify.sanitize(dirty, {ADD_TAGS: ['my-tag']});

// extend the existing array of attributes
var clean = DOMPurify.sanitize(dirty, {ADD_ATTR: ['my-attr']});

// prohibit HTML5 data attributes (default is true)
var clean = DOMPurify.sanitize(dirty, {ALLOW_DATA_ATTR: false});

// allow external protocol handlers in URL attributes (default is false)
// by default only http, https, ftp, ftps, tel, mailto, callto, cid and xmpp are allowed.
var clean = DOMPurify.sanitize(dirty, {ALLOW_UNKNOWN_PROTOCOLS: true});

// allow specific protocols handlers in URL attributes (default is false)
// by default only http, https, ftp, ftps, tel, mailto, callto, cid and xmpp are allowed.
// Default RegExp: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
var clean = DOMPurify.sanitize(dirty, {ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;});

// return a DOM HTMLBodyElement instead of an HTML string (default is false)
var clean = DOMPurify.sanitize(dirty, {RETURN_DOM: true});

// return a DOM DocumentFragment instead of an HTML string (default is false)
var clean = DOMPurify.sanitize(dirty, {RETURN_DOM_FRAGMENT: true});

// return a DOM DocumentFragment instead of an HTML string (default is false)
// also import it into the current document (default is false).
// RETURN_DOM_IMPORT must be set if you would like to append
// the returned node to the current document
var clean = DOMPurify.sanitize(dirty, {RETURN_DOM_FRAGMENT: true, RETURN_DOM_IMPORT: true});
document.body.appendChild(clean);

// return entire document including <html> tags (default is false)
var clean = DOMPurify.sanitize(dirty, {WHOLE_DOCUMENT: true});

// disable DOM Clobbering protection on output (default is true, handle with care!)
var clean = DOMPurify.sanitize(dirty, {SANITIZE_DOM: false});

// discard an element's content when the element is removed (default is true)
var clean = DOMPurify.sanitize(dirty, {KEEP_CONTENT: false});

// glue elements like style, script or others to document.body and prevent unintuitive browser behavior in several edge-cases (default is false)
var clean = DOMPurify.sanitize(dirty, {FORCE_BODY: true});

// use the IN_PLACE mode to sanitize a node "in place", which is much faster depending on how you use DOMpurify
var dirty = document.createElement('a');
dirty.setAttribute('href', 'javascript:alert(1)');
var clean = DOMPurify.sanitize(dirty, {IN_PLACE: true}); // see https://github.com/cure53/DOMPurify/issues/288 for more info
```
There is even [more examples here](https://github.com/cure53/DOMPurify/tree/master/demos#what-is-this), showing how you can run, customize and configure DOMPurify to fit your needs.

## Persistent Configuration

Instead of repeatedly passing the same configuration to `DOMPurify.sanitize`, you can use the `DOMPurify.setConfig` method. Your configuration will persist until your next call to `DOMPurify.setConfig`, or until you invoke `DOMPurify.clearConfig` to reset it. Remember that there is only one active configuration, which means once it is set, all extra configuration parameters passed to `DOMPurify.sanitize` are ignored.

## Hooks

DOMPurify allows you to augment its functionality by attaching one or more functions with the `DOMPurify.addHook` method to one of the following hooks:

- `beforeSanitizeElements`
- `uponSanitizeElement`
- `afterSanitizeElements`
- `beforeSanitizeAttributes`
- `uponSanitizeAttribute`
- `afterSanitizeAttributes`
- `beforeSanitizeShadowDOM`
- `uponSanitizeShadowNode`
- `afterSanitizeShadowDOM`

It passes the currently processed DOM node, when needed a literal with verified node and attribute data and the DOMPurify configuration to the callback. Check out the [MentalJS hook demo](https://github.com/cure53/DOMPurify/blob/master/demos/hooks-mentaljs-demo.html) to see how the API can be used nicely.

_Example_:

```javascript
DOMPurify.addHook('beforeSanitizeElements', function(currentNode, data, config) {
    // Do something with the current node and return it
    return currentNode;
});
```

## Continuous Integration

We are currently using Travis CI in combination with BrowserStack. This gives us the possibility to confirm for each and every commit that all is going according to plan in all supported browsers. Check out the build logs here: https://travis-ci.org/cure53/DOMPurify

You can further run local tests by executing `npm test`. The tests work fine with Node.js v0.6.2 and jsdom@8.5.0.

All relevant commits will be signed with the key `0x24BB6BF4` for additional security (since 8th of April 2016).

### Development and contributing

#### Installation (`yarn i`)

We support both `yarn` and `npm@5.2` officially while providing lock-files for either dependency manager to provide reproducible installs and builds on either or. TravisCI itself is configured to install dependencies using `yarn`. When using an older version of `npm` we can not fully ensure the versions of installed dependencies which might lead to unanticipated problems.

#### Scripts

We rely on npm run-scripts for integrating with out tooling infrastructure. We use ESLint as a pre-commit hook to ensure code consistency. Moreover, to ease formatting we use [prettier](https://github.com/prettier/prettier) while building the `/dist` assets happens through `rollup`.

These are our npm scripts:

- `npm run dev` to start building while watching sources for changes
- `npm run test` to run our test suite via jsdom and karma
  - `test:jsdom` to only run tests through jsdom
  - `test:karma` to only run tests through karma
- `npm run lint` to lint the sources using ESLint (via xo)
- `npm run format` to format our sources using prettier to ease to pass ESLint
- `npm run build` to build our distribution assets minified and unminified as a UMD module
  - `npm run build:umd` to only build an unminified UMD module
  - `npm run build:umd:min` to only build a minified UMD module

Note: all run scripts triggered via `npm run <script>` can also be started using `yarn <script>`.

There are more npm scripts but they are mainly to integrate with CI or are meant to be "private" for instance to amend build distribution files with every commit.

## Security Mailing List

We maintain a mailing list that notifies whenever a security-critical release of DOMPurify was published. This means, if someone found a bypass and we fixed it with a release (which always happens when a bypass was found) a mail will go out to that list. This usually happens within minutes or few hours after learning about a bypass. The list can be subscribed to here:

[https://lists.ruhr-uni-bochum.de/mailman/listinfo/dompurify-security](https://lists.ruhr-uni-bochum.de/mailman/listinfo/dompurify-security)

Feature releases will not be announced to this list.

## Who contributed?

Several people need to be listed here!

[@garethheyes](https://twitter.com/garethheyes) and [@filedescriptor](https://twitter.com/filedescriptor) for invaluable help, [@shafigullin](https://twitter.com/shafigullin) for breaking the library multiple times and thereby strengthening it, [@mmrupp](https://twitter.com/mmrupp) and [@irsdl](https://twitter.com/irsdl) for doing the same. And lastly, thanks to  @ShikariSenpai and @ansjdnakjdnajkd for spotting the [massive Safari 10.1 bug](https://github.com/cure53/DOMPurify/releases/tag/0.8.6) in the first place.

Big thanks also go to [@ydaniv](https://github.com/ydaniv), [@asutherland](https://twitter.com/asutherland), [@mathias](https://twitter.com/mathias), [@cgvwzq](https://twitter.com/cgvwzq), [@robbertatwork](https://twitter.com/robbertatwork), [@giutro](https://twitter.com/giutro) and [@fhemberger](https://twitter.com/fhemberger)!

Further, thanks [@neilj](https://twitter.com/neilj) and [@0xsobky](https://twitter.com/0xsobky) for their code reviews and countless small optimizations, fixes and beautifications.

Big thanks also go to [@tdeekens](https://twitter.com/tdeekens) for doing all the hard work and getting us on track with Travis CI and BrowserStack. And thanks to [@Joris-van-der-Wel](https://github.com/Joris-van-der-Wel) for setting up DOMPurify for jsdom and creating the additional test suite. And again [@tdeekens](https://twitter.com/tdeekens) for his [incredible efforts](https://github.com/cure53/DOMPurify/pull/206) and contribution to refactor DOMPurify into using ES201x, proper build tools, better test coverage and much more!

And last but not least, thanks to [BrowserStack](https://browserstack.com) for supporting this project with their services for free and delivering excellent, dedicated and very professional support on top of that.
