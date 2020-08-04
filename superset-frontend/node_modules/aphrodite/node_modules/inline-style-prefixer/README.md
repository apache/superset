# inline-style-prefixer

A small, simple and fast vendor prefixer from JavaScript style object.

<img alt="TravisCI" src="https://travis-ci.org/rofrischmann/inline-style-prefixer.svg?branch=master"> <a href="https://codeclimate.com/github/rofrischmann/inline-style-prefixer/coverage"><img alt="Test Coverage" src="https://codeclimate.com/github/rofrischmann/inline-style-prefixer/badges/coverage.svg"></a> <img alt="npm downloads" src="https://img.shields.io/npm/dm/inline-style-prefixer.svg"> <img alt="gzipped size" src="https://img.shields.io/bundlephobia/minzip/inline-style-prefixer.svg?colorB=4c1&label=gzipped%20size"> <img alt="npm version" src="https://badge.fury.io/js/inline-style-prefixer.svg">

## Support Us
Support Robin Frischmann's work on [Fela](https://github.com/rofrischmann/fela) and its ecosystem (inline-style-prefixer) directly via [**Patreon**](https://www.patreon.com/rofrischmann).

## Installation
```sh
yarn add inline-style-prefixer
```
If you're still using npm, you may run `npm i --save inline-style-prefixer`.

## Browser Support
It supports all major browsers with the following versions. For other, unsupported browses, we automatically use a fallback.
* Chrome: 55+
* Android (Chrome): 55+
* Android (Stock Browser): 5+
* Android (UC): 11+
* Firefox: 52+
* Safari: 9+
* iOS (Safari): 9+
* Opera: 30+
* Opera (Mini): 12+
* IE: 11+
* IE (Mobile): 11+
* Edge: 12+

It will **only** add prefixes if a property still needs them in one of the above mentioned versions.<br> Therefore, e.g. `border-radius` will not be prefixed at all.

> **Need to support legacy browser versions?**<br>
Don't worry - we got you covered. Check [this guide](https://github.com/rofrischmann/inline-style-prefixer/blob/master/docs/guides/CustomPrefixer.md).


## Usage

```javascript
import { prefix } from 'inline-style-prefixer'

const style = {
  transition: '200ms all linear',
  boxSizing: 'border-box',
  display: 'flex',
  color: 'blue'
}

const output = prefix(style)

output === {
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
yarn add @types/inline-style-prefixer

# alternatively use npm
npm i --save @types/inline-style-prefixer
```

## Documentation
If you got any issue using this prefixer, please first check the FAQ's. Most cases are already covered and provide a solid solution.

* [Usage Guides](https://inline-style-prefixer.js.org/docs/UsageGuides.html)
* [Data Reference](https://inline-style-prefixer.js.org/docs/DataReference.html)
* [API Reference](https://inline-style-prefixer.js.org/docs/API.html)

## Community
Here are some popular users of this library:

* [Aphrodite](https://github.com/Khan/aphrodite)
* [Fela](https://github.com/rofrischmann/fela)
* [Glamor](https://github.com/threepointone/glamor)
* [Material UI](https://github.com/callemall/material-ui)
* [nano-css](https://github.com/streamich/nano-css)
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
