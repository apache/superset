# Change log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [v3.0.0](https://github.com/reduxjs/reselect/releases/tag/v3.0.0) - 2017/03/24

### New Features

Performance improvements (thanks to @johnhaley81)  
Updated Typescript typings (thanks to everyone who helped)

### Breaking Changes

For performance reasons, a selector is now not recalculated if its input is equal by reference (`===`).

#### Example:

```js
import { createSelector } from 'reselect';

const mySelector = createSelector(
  state => state.values.filter(val => val < 5),
  values => {
    console.log('calling..')
    return values.reduce((acc, val) => acc + val, 0)
  }
)

var createSelector = require('./dist/reselect.js').createSelector;

const mySelector = createSelector(
  state => state.values.filter(val => val < 5),
  values => {
    console.log('calling..')
    return values.reduce((acc, val) => acc + val, 0)
  }
)

var state1 = {values: [1,2,3,4,5,6,7,8,9]};
console.log(mySelector(state1));
state1.values = [3,4,5,6,7,8,9];
console.log(mySelector(state1));
var state2 = {values: [1,2,3,4,5,6,7,8,9]};
console.log(mySelector(state2));
var state3 = {values: [3,4,5,6,7]};
console.log(mySelector(state3));
```

#### Output in v2.5.4:

```
calling..
10
calling..
7
calling..
10
calling..
7
```

#### Output in v3.0.0:

```
calling..
10
10
calling..
10
calling..
7
```

## [v2.5.4](https://github.com/reduxjs/reselect/releases/tag/v2.5.4) - 2016/09/17

### Bug Fixes

Improve performance of `defaultMemoize` when using custom equality check. (#170)

## [v2.5.3](https://github.com/reduxjs/reselect/releases/tag/v2.5.3) - 2016/07/04

### Bug Fixes

Reverts a Typescript change that was a breaking change. It will be reinstated in a major release. (#145)

## [v2.5.2](https://github.com/reduxjs/reselect/releases/tag/v2.5.2) - 2016/07/03

### Bug Fixes

When a selector uses defaultMemoize, if an exception is thrown for a set of arguments then the selector should also throw when called again with those arguments. (#144)

## [v2.5.1](https://github.com/reduxjs/reselect/releases/tag/v2.5.1) - 2016/04/21

### Bug Fixes

Include es directory in package.json (#117)

## [v2.5.0](https://github.com/reduxjs/reselect/releases/tag/v2.5.0) - 2016/04/21

### New features

Add jsnext build (#116)

## [v2.4.0](https://github.com/reduxjs/reselect/releases/tag/v2.4.0) - 2016/04/16

### New features

Add umd build (#112)

## [v2.3.0](https://github.com/reduxjs/reselect/releases/tag/v2.3.0) - 2016/04/07

### New features

Add `resultFunc` property to selectors (#92)

## [v2.2.0](https://github.com/reduxjs/reselect/releases/tag/v2.2.0) - 2016/03/15

### New features

Add Typescript typings to package.json (#94)

## [v2.1.0](https://github.com/reduxjs/reselect/releases/tag/v2.1.0) - 2016/03/03

### New features

Add `resetRecomputations` method to selectors (#90)

## [v2.0.3](https://github.com/reduxjs/reselect/releases/tag/v2.0.3) - 2016/02/01

### New features

Fix bug (#78) in `defaultMemoize` which could cause the memoized value to be mistakenly returned for variadic functions.

## [v2.0.2](https://github.com/reduxjs/reselect/releases/tag/v2.0.2) - 2016/01/14

### New features

Fix IE8 support by compiling in 'loose' mode

## [v2.0.1](https://github.com/reduxjs/reselect/releases/tag/v2.0.1) - 2015/11/08

### Chore

Update README and github links since move to reduxjs.

## [v2.0.0](https://github.com/reduxjs/reselect/releases/tag/v2.0.0) - 2015/10/02

### Breaking Changes

#### `createSelector`, `createStructuredSelector`, and custom selector creators check arguments

Input selectors are now verified to be functions during selector creation. If verification fails an error is thrown, allowing for a useful stack trace

There is a small chance that this could cause a breaking change in code that contains a faulty selector that is never called.

## [v1.1.0](https://github.com/reduxjs/reselect/releases/tag/v1.1.0) - 2015/09/16

### New features

#### `createStructuredSelector`

`createStructuredSelector` is a convenience function that helps with a common pattern when using Reselect.  The selector passed to a connect decorator often just takes other selectors and maps them to keys in an object:

```js
const mySelectorA = state => state.a;
const mySelectorB = state => state.b;

const structuredSelector = createSelector(
   mySelectorA,
   mySelectorB,
   mySelectorC,
   (a, b, c) => ({
     a, 
     b,
     c
   })
);
```

`createStructuredSelector` takes an object whose properties are input-selectors and returns a structured selector. The structured selector returns an object with the same keys as the `inputSelectors` argument, but with the selectors replaced with their values.

```js
const mySelectorA = state => state.a;
const mySelectorB = state => state.b;

const structuredSelector = createStructuredSelector({
  x: mySelectorA,
  y: mySelectorB
});

const result = structuredSelector({a: 1, b: 2}); // will produce {x: 1, y: 2}
```

## [v1.0.0](https://github.com/reduxjs/reselect/releases/tag/v1.0.0) - 2015/09/09

### Breaking Changes

If upgrading from 0.0.2, see the release notes for v1.0.0-alpha

## [v1.0.0-alpha2](https://github.com/reduxjs/reselect/releases/tag/v1.0.0-alpha2) - 2015/09/01

### New features

src directory included in npm package
js:next field added to package.json

## [v1.0.0-alpha](https://github.com/reduxjs/reselect/releases/tag/v1.0.0-alpha) - 2015/09/01

### Breaking Changes

`createSelectorCreator` takes a user specified memoize function instead of a custom `valueEqualsFunc`.

#### Before

```js
import { isEqual } from 'lodash';
import { createSelectorCreator } from 'reselect';

const deepEqualsSelectorCreator = createSelectorCreator(isEqual);
```

#### After

```js
import { isEqual } from 'lodash';
import { createSelectorCreator, defaultMemoize } from 'reselect';

const deepEqualsSelectorCreator = createSelectorCreator(
  defaultMemoize,
  isEqual
);
```

### New features

#### Variadic Dependencies

Selector creators can receive a variadic number of dependencies as well as an array of dependencies.

#### Before

```js
const selector = createSelector(
  [state => state.a, state => state.b],
  (a, b) => a * b
);
```

#### After

```js
const selector = createSelector(
  state => state.a,
  state => state.b,
  (a, b) => a * b
);
```

#### Access `ownProps` in Selector

Selector dependencies can receive a variadic number of parameters allowing a selector to receive `ownProps` passed from `mapToProps` in `connect`.

```js
const selector = createSelector(
  (state) => state.a,
  (state, props) => state.b * props.c,
  (_, props) => props.d,
  (a, bc, d) => a + bc + d
);
```

#### Configurable Memoize Function

```js
import { createSelectorCreator } from 'reselect';
import memoize from 'lodash.memoize';

let called = 0;
const customSelectorCreator = createSelectorCreator(memoize, JSON.stringify);
const selector = customSelectorCreator(
  state => state.a,
  state => state.b,
  (a, b) => {
    called++;
    return a + b;
  }
);
assert.equal(selector({a: 1, b: 2}), 3);
assert.equal(selector({a: 1, b: 2}), 3);
assert.equal(called, 1);
assert.equal(selector({a: 2, b: 3}), 5);
assert.equal(called, 2);
```
