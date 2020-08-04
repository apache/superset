# Autoprefixer for Style Objects

**inline-style-prefixer** adds required **vendor prefixes** to your style object. It only adds prefixes if they're actually required by evaluating the browser's `userAgent` against data from [caniuse.com](http://caniuse.com/).
<br>

Alternatively it ships a static version that adds all available vendor prefixes.

[![Build Status](https://travis-ci.org/rofrischmann/inline-style-prefixer.svg)](https://travis-ci.org/rofrischmann/inline-style-prefixer)
[![Test Coverage](https://codeclimate.com/github/rofrischmann/inline-style-prefixer/badges/coverage.svg)](https://codeclimate.com/github/rofrischmann/inline-style-prefixer/coverage)
[![npm downloads](https://img.shields.io/npm/dm/inline-style-prefixer.svg)](https://img.shields.io/npm/dm/inline-style-prefixer.svg)
![Dependencies](https://david-dm.org/rofrischmann/inline-style-prefixer.svg)

## Installation
```sh
yarn add inline-style-prefixer
```
If you're still using npm, you may run `npm i --save inline-style-prefixer`.
We also provide [UMD](https://github.com/umdjs/umd) builds for each package in the `dist` folder. You can easily use them via [unpkg](https://unpkg.com/).
```HTML
<!-- Unminified versions -->
<script src="https://unpkg.com/inline-style-prefixer@3.0.1/dist/inline-style-prefixer.js"></script>
<script src="https://unpkg.com/inline-style-prefixer@3.0.1/dist/inline-style-prefix-all.js"></script>
<!-- Minified versions -->
<script src="https://unpkg.com/inline-style-prefixer@3.0.1/dist/inline-style-prefixer.min.js"></script>
<script src="https://unpkg.com/inline-style-prefixer@3.0.1/dist/inline-style-prefix-all.min.js"></script>
```

## Browser Support
It supports all major browsers with the following versions. For other, unsupported browses, we automatically use a fallback.
* Chrome: 46+
* Android (Chrome): 46+
* Android (Stock Browser): 4+
* Android (UC): 9+
* Firefox: 40+
* Safari: 8+
* iOS (Safari): 8+
* Opera: 16+
* Opera (Mini): 12+
* IE: 11+
* IE (Mobile): 11+
* Edge: 12+

It will **only** add prefixes if a property still needs them in one of the above mentioned versions.<br> Therefore, e.g. `border-radius` will not be prefixed at all.

> **Need to support legacy browser versions?**<br>
Don't worry - we got you covered. Check [this guide](https://github.com/rofrischmann/inline-style-prefixer/blob/master/docs/guides/CustomPrefixer.md).


## Dynamic vs. Static
Before using the prefixer, you have to decide which one you want to use. We ship two different versions - a dynamic and a static version.

The **dynamic prefixer** evaluates the `userAgent` to identify the browser environment. Using this technique, we are able to only add the bare minimum of prefixes. Browser detection is quite accurate (~90% correctness), but yet also  	expensive which is why the package is almost 3 times as big as the static version.

> It uses the static prefixer as a fallback.

![Gzipped Size](https://img.shields.io/badge/gzipped-8.50kb-brightgreen.svg)

```javascript
import Prefixer from 'inline-style-prefixer'

const style = {
  transition: '200ms all linear',
  userSelect: 'none',
  boxSizing: 'border-box',
  display: 'flex',
  color: 'blue'
}

const prefixer = new Prefixer()
const prefixedStyle = prefixer.prefix(style)

// prefixedStyle === output
const output = {
  transition: '200ms all linear',
  WebkitUserSelect: 'none',
  boxSizing: 'border-box',
  display: '-webkit-flex',
  color: 'blue'
}
```

The **static prefixer**, on the other hand, adds all required prefixes according the above mentioned browser versions. Removing the browser detection makes it both smaller and fast, but also drastically increases the output.

![Gzipped Size](https://img.shields.io/badge/gzipped-2.70kb-brightgreen.svg)

```javascript
import prefixAll from 'inline-style-prefixer/static'

const style = {
  transition: '200ms all linear',
  boxSizing: 'border-box',
  display: 'flex',
  color: 'blue'
}

const prefixedStyle = prefixAll(style)

// prefixedStyle === output
const output = {
  WebkitTransition: '200ms all linear',
  transition: '200ms all linear',
  MozBoxSizing: 'border-box',
  boxSizing: 'border-box',
  display: [ '-webkit-box', '-moz-box', '-ms-flexbox', '-webkit-flex', 'flex' ]
  color: 'blue'
}
```

## Usage with TypeScript
You can use TypeScript definition from [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/inline-style-prefixer) using [@types/inline-style-prefixer](https://www.npmjs.com/package/@types/inline-style-prefixer)

```sh
npm install --save @types/inline-style-prefixer
```

Then import in your code:

```typescript
import prefixAll = require('inline-style-prefixer/static');

const prefixedStyle = prefixAll({
  transition: '200ms all linear',
  boxSizing: 'border-box',
  display: 'flex',
  color: 'blue'
});
```

## Documentation
If you got any issue using this prefixer, please first check the FAQ's. Most cases are already covered and provide a solid solution.

* [Usage Guides](https://inline-style-prefixer.js.org/docs/UsageGuides.html)
* [Data Reference](https://inline-style-prefixer.js.org/docs/DataReference.html)
* [API Reference](https://inline-style-prefixer.js.org/docs/API.html)
* [FAQ](https://inline-style-prefixer.js.org/docs/FAQ.html)

## Community
Here are some popular users of this library:

* [Aphrodite](https://github.com/Khan/aphrodite)
* [Fela](https://github.com/rofrischmann/fela)
* [Glamor](https://github.com/threepointone/glamor)
* [Material UI](https://github.com/callemall/material-ui)
* [Radium](https://github.com/FormidableLabs/radium)
* [react-native-web](https://github.com/necolas/react-native-web)
* [styled-components](https://github.com/styled-components/styled-components)
* [Styletron](https://github.com/rtsao/styletron)

> PS: Feel free to add your solution!

## Support
Join us on [Gitter](https://gitter.im/rofrischmann/fela). We highly appreciate any contribution.<br>
We also love to get feedback.

## License
**inline-style-prefixer** is licensed under the [MIT License](http://opensource.org/licenses/MIT).<br>
Documentation is licensed under [Creative Common License](http://creativecommons.org/licenses/by/4.0/).<br>
Created with ♥ by [@rofrischmann](http://rofrischmann.de) and all contributors.
