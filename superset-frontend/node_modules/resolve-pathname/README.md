# resolve-pathname [![Travis][build-badge]][build] [![npm package][npm-badge]][npm]

[build-badge]: https://img.shields.io/travis/mjackson/resolve-pathname/master.svg?style=flat-square
[build]: https://travis-ci.org/mjackson/resolve-pathname
[npm-badge]: https://img.shields.io/npm/v/resolve-pathname.svg?style=flat-square
[npm]: https://www.npmjs.org/package/resolve-pathname

[resolve-pathname](https://www.npmjs.com/package/resolve-pathname) resolves URL pathnames identical to the way browsers resolve the pathname of an `<a href>` value. The goals are:

- 100% compatibility with browser pathname resolution
- Pure JavaScript implementation (no DOM dependency)

## Installation

Using [npm](https://www.npmjs.com/):

    $ npm install --save resolve-pathname

Then, use as you would anything else:

```js
// using ES6 modules
import resolvePathname from 'resolve-pathname';

// using CommonJS modules
var resolvePathname = require('resolve-pathname');
```

The UMD build is also available on [unpkg](https://unpkg.com):

```html
<script src="https://unpkg.com/resolve-pathname"></script>
```

You can find the library on `window.resolvePathname`.

## Usage

```js
import resolvePathname from 'resolve-pathname';

// Simply pass the pathname you'd like to resolve. Second
// argument is the path we're coming from, or the current
// pathname. It defaults to "/".
resolvePathname('about', '/company/jobs'); // /company/about
resolvePathname('../jobs', '/company/team/ceo'); // /company/jobs
resolvePathname('about'); // /about
resolvePathname('/about'); // /about

// Index paths (with a trailing slash) are also supported and
// work the same way as browsers.
resolvePathname('about', '/company/info/'); // /company/info/about

// In browsers, it's easy to resolve a URL pathname relative to
// the current page. Just use window.location! e.g. if
// window.location.pathname == '/company/team/ceo' then
resolvePathname('cto', window.location.pathname); // /company/team/cto
resolvePathname('../jobs', window.location.pathname); // /company/jobs
```

## Prior Work

- [url.resolve](https://nodejs.org/api/url.html#url_url_resolve_from_to) - node's `url.resolve` implementation for full URLs
- [resolve-url](https://www.npmjs.com/package/resolve-url) - A DOM-dependent implementation of the same algorithm
