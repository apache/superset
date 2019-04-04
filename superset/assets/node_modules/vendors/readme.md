# vendors [![Build Status][travis-badge]][travis]

<!--lint disable no-html-->

List of (real<sup>†</sup>) vendor prefixes known to the web platform.
From [Wikipedia][wiki] and the [CSS 2.1 spec][spec].

† — real, as in, `mso-` and `prince-` are not included because they are
not valid.

## Installation

[npm][]:

```bash
npm install vendors
```

## Usage

```javascript
var vendors = require('vendors')

console.log(vendors)
```

Yields:

```js
[ 'ah',
  'apple',
  'atsc',
  'epub',
  'hp',
  'khtml',
  'moz',
  'ms',
  'o',
  'rim',
  'ro',
  'tc',
  'wap',
  'webkit',
  'xv' ]
```

## License

[MIT][license] © [Titus Wormer][author]

<!-- Definitions -->

[travis-badge]: https://img.shields.io/travis/wooorm/vendors.svg

[travis]: https://travis-ci.org/wooorm/vendors

[npm]: https://docs.npmjs.com/cli/install

[license]: LICENSE

[author]: http://wooorm.com

[wiki]: https://en.wikipedia.org/wiki/CSS_filter#Prefix_filters

[spec]: https://www.w3.org/TR/CSS21/syndata.html#vendor-keyword-history
