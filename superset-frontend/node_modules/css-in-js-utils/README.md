# CSS-in-JS Utilities
A library that provides useful utilities functions for CSS-in-JS solutions.<br>
They are intended to be used by CSS-in-JS library authors rather used directly.
<br>

<img alt="TravisCI" src="https://travis-ci.org/rofrischmann/css-in-js-utils.svg?branch=master"> <a href="https://codeclimate.com/github/rofrischmann/css-in-js-utils/coverage"><img alt="Test Coverage" src="https://codeclimate.com/github/rofrischmann/css-in-js-utils/badges/coverage.svg"></a> <img alt="npm downloads" src="https://img.shields.io/npm/dm/css-in-js-utils.svg"> <img alt="npm version" src="https://badge.fury.io/js/css-in-js-utils.svg">

## Installation
```sh
yarn add css-in-js-utils
```

## Why?
By now I have authored and collaborated on many different libraries and found I would rewrite the very same utility functions every time. That's why this repository is hosting small utilities especially built for CSS-in-JS solutions and tools. Even if there are tons of different libraries already, they all basically use the same mechanisms and utilities.

## Utilities
* [`assignStyle(base, ...extend)`](#assignstylebase-extend)
* [`camelCaseProperty(property)`](#camelcasepropertyproperty)
* [`cssifyDeclaration(property, value)`](#cssifydeclarationproperty-value)
* [`cssifyObject(object)`](#cssifyobjectobject)
* [`hyphenateProperty(property)`](#hyphenatepropertyproperty)
* [`isPrefixedProperty(property)`](#isprefixedpropertyproperty)
* [`isPrefixedValue(value)`](#isprefixedvaluevalue)
* [`isUnitlessProperty(property)`](#isunitlesspropertyproperty)
* [`normalizeProperty(property)`](#normalizepropertyproperty)
* [`resolveArrayValue(property, value)`](#resolvearrayvalueproperty-value)
* [`unprefixProperty(property)`](#unprefixpropertyproperty)
* [`unprefixValue(value)`](#unprefixvaluevalue)

------

### `assignStyle(base, ...extend)`
Merges deep style objects similar to `Object.assign`.

```javascript
import { assignStyle } from 'css-in-js-utils'

assignStyle(
  { color: 'red', backgroundColor: 'black' },
  { color: 'blue' }
)
// => { color: 'blue', backgroundColor: 'black' }

assignStyle(
  {
    color: 'red',
    ':hover': {
      backgroundColor: 'black'
    }
  },
  { 
    ':hover': {
      backgroundColor: 'blue'
    }
  }
)
// => { color: 'red', ':hover': { backgroundColor: 'blue' }}
```

------

### `camelCaseProperty(property)`
Converts the `property` to camelCase.

```javascript
import { camelCaseProperty } from 'css-in-js-utils'

camelCaseProperty('padding-top')
// => 'paddingTop'

camelCaseProperty('-webkit-transition')
// => 'WebkitTransition'
```

------

### `cssifyDeclaration(property, value)`
Generates a CSS declaration (`property`:`value`) string.

```javascript
import { cssifyDeclaration } from 'css-in-js-utils'

cssifyDeclaration('paddingTop', '400px')
// => 'padding-top:400px'

cssifyDeclaration('WebkitFlex', 3)
// => '-webkit-flex:3'
```

------

### `cssifyObject(object)`
Generates a CSS string using all key-property pairs in `object`.
It automatically removes declarations with value types other than `number` and `string`.

```javascript
import { cssifyObject } from 'css-in-js-utils'

cssifyObject({
  paddingTop: '400px',
  paddingBottom: undefined,
  WebkitFlex: 3,
  _anyKey: [1, 2, 4]
})
// => 'padding-top:400px;-webkit-flex:3'
```

------

### `hyphenateProperty(property)`
Converts the `property` to hyphen-case.
> Directly mirrors [hyphenate-style-name](https://github.com/rexxars/hyphenate-style-name).

```javascript
import { hyphenateProperty } from 'css-in-js-utils'

hyphenateProperty('paddingTop')
// => 'padding-top'

hyphenateProperty('WebkitTransition')
// => '-webkit-transition'
```

------

### `isPrefixedProperty(property)`
Checks if a `property` includes a vendor prefix.

```javascript
import { isPrefixedProperty } from 'css-in-js-utils'

isPrefixedProperty('paddingTop')
// => false

isPrefixedProperty('WebkitTransition')
// => true
```

------
### `isPrefixedValue(value)`
Checks if a `value` includes vendor prefixes.

```javascript
import { isPrefixedValue } from 'css-in-js-utils'

isPrefixedValue('200px')
isPrefixedValue(200)
// => false

isPrefixedValue('-webkit-calc(100% - 50px)')
// => true
```

------

### `isUnitlessProperty(property)`
Checks if a `property` accepts unitless values.

```javascript
import { isUnitlessProperty } from 'css-in-js-utils'

isUnitlessProperty('width')
// => false

isUnitlessProperty('flexGrow')
isUnitlessProperty('lineHeight')
isUnitlessProperty('line-height')
// => true
```

------

### `normalizeProperty(property)`
Normalizes the `property` by unprefixing **and** camelCasing it.
> Uses the [`camelCaseProperty`](#camelcasepropertyproperty) and [`unprefixProperty`](#unprefixpropertyproperty)-methods.

```javascript
import { normalizeProperty } from 'css-in-js-utils'

normalizeProperty('-webkit-transition-delay')
// => 'transitionDelay'
```

------

### `resolveArrayValue(property, value)`
Concatenates array values to single CSS value.
> Uses the [`hyphenateProperty`](#hyphenatepropertyproperty)-method.


```javascript
import { resolveArrayValue } from 'css-in-js-utils'

resolveArrayValue('display', [ '-webkit-flex', 'flex' ])
// => '-webkit-flex;display:flex'

resolveArrayValue('paddingTop', [ 'calc(100% - 50px)', '100px' ])
// => 'calc(100% - 50px);padding-top:100px'
```

------

### `unprefixProperty(property)`
Removes the vendor prefix (if set) from the `property`.

```javascript
import { unprefixProperty } from 'css-in-js-utils'

unprefixProperty('WebkitTransition')
// => 'transition'

unprefixProperty('transitionDelay')
// => 'transitionDelay'
```

------

### `unprefixValue(value)`
Removes all vendor prefixes (if any) from the `value`.

```javascript
import { unprefixValue } from 'css-in-js-utils'

unprefixValue('-webkit-calc(-moz-calc(100% - 50px)/2)')
// => 'calc(calc(100% - 50px)/2)'

unprefixValue('100px')
// => '100px'
```

## Direct Import
Every utility function may be imported directly to save bundle size.

```javascript
import camelCaseProperty from 'css-in-js-utils/lib/camelCaseProperty'
```

## License
css-in-js-utils is licensed under the [MIT License](http://opensource.org/licenses/MIT).<br>
Documentation is licensed under [Creative Common License](http://creativecommons.org/licenses/by/4.0/).<br>
Created with ♥ by [@rofrischmann](http://rofrischmann.de).
