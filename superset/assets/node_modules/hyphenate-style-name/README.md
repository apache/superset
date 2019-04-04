# hyphenate-style-name

[![npm version](http://img.shields.io/npm/v/hyphenate-style-name.svg?style=flat-square)](http://browsenpm.org/package/hyphenate-style-name)[![Build Status](http://img.shields.io/travis/rexxars/hyphenate-style-name/master.svg?style=flat-square)](https://travis-ci.org/rexxars/hyphenate-style-name)

Hyphenates a camelcased CSS property name. For example:

- `backgroundColor` => `background-color`
- `MozTransition` => `-moz-transition`
- `msTransition` => `-ms-transition`
- `color` => `color`

# Installation

```bash
$ npm install --save hyphenate-style-name
```

# Usage

```js
var hyphenateStyleName = require('hyphenate-style-name')

console.log(hyphenateStyleName('MozTransition')) // -moz-transition
```

# License

BSD-3-Clause licensed. See LICENSE.
