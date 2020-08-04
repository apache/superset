# react-prop-types [![Travis][build-badge]][build] [![npm][npm-badge]][npm]

Additional [PropTypes](https://facebook.github.io/react/docs/reusable-components.html#prop-validation) for [React](https://facebook.github.io/react/).

## Usage

```js
import elementType from 'react-prop-types/lib/elementType';
// or
import { elementType } from 'react-prop-types';

const propTypes = {
  someProp: elementType,
};
```

If you want to minimize bundle size, import only the validators you use via:

```js
import elementType from 'react-prop-types/lib/elementType'
```

## Guide

### Installation

```sh
$ npm i -S react
$ npm i -S react-prop-types
```

### [`all(...validators)`](/src/all.js)

This validator checks that all of the provided validators pass.

```js
const propTypes = {
  vertical:  React.PropTypes.bool.isRequired,

  block: all(
    React.PropTypes.bool.isRequired,
    ({ block, vertical }) => (
      block && !vertical ?
        new Error('`block` requires `vertical` to be set to have any effect') :
        null
    ),
  ),
};
```

The provided validators will be validated in order, stopping on the first failure. The combined validator will succeed only if all provided validators succeed.

As in the example, this can be used to make a type assertion along with additional semantic assertions.

### [`componentOrElement`](/src/componentOrElement.js)

Checks that the value is a `ReactComponent` or a `DOMElement`.

```js
const propTypes = {
  container: componentOrElement,
  requiredContainer: componentOrElement.isRequired,
};
```

This ensures that the value is of the right type to pass to `ReactDOM.findDOMNode()`, for cases where you need a DOM node.

### [`deprecated(validator, reason)`](/src/deprecated.js)

This validator will log a deprecation warning if the value is present.

```js
const propTypes = {
  collapsable: deprecated(React.PropTypes.bool, 'Use `collapsible` instead.'),
};
```

If the `collapsable` prop above is specified, this validator will log the warning:

>The prop \`collapsable\` of \`MyComponent\` is deprecated. Use \`collapsible\` instead.

This validator warns instead of failing on invalid values, and will still call the underlying validator if the deprecated value is present.

This validator will only warn once on each deprecation. To clear the cache of warned messages, such as for clearing state between test cases intended to fail on deprecation warnings, call `deprecated._resetWarned()`.

### [`elementType`](/src/elementType.js)

Checks that the value is a React element type. This can be either a string (for DOM elements) or a `ReactClass` (for composite components).

```js
const propTypes = {
  Component: elementType.isRequired,
};
```

This ensures that the value of is the right type for creating a `ReactElement`, such as with `<Component {...props} />`.

### [`isRequiredForA11y(validator)`](/src/isRequiredForA11y.js)

This validator checks that the value required for accessibility are present.

```js
const propTypes = {
  id: isRequiredForA11y(React.PropTypes.string),
};
```

If the `id` prop above is not specified, the validator will fail with:

>The prop \`id\` is required to make \`MyComponent\` accessible for users of assistive technologies such as screen readers.

[build-badge]: https://img.shields.io/travis/react-bootstrap/react-prop-types/master.svg
[build]: https://travis-ci.org/react-bootstrap/react-prop-types

[npm-badge]: https://img.shields.io/npm/v/react-prop-types.svg
[npm]: https://www.npmjs.org/package/react-prop-types
