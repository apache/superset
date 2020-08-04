# prop-types <sup>[![Version Badge][npm-version-svg]][package-url]</sup>

[![Build Status][travis-svg]][travis-url]
[![dependency status][deps-svg]][deps-url]
[![dev dependency status][dev-deps-svg]][dev-deps-url]
[![License][license-image]][license-url]
[![Downloads][downloads-image]][downloads-url]

[![npm badge][npm-badge-png]][package-url]

Custom React PropType validators that we use at Airbnb. Use of [airbnb-js-shims](https://npmjs.com/package/airbnb-js-shims) or the equivalent is recommended.

 - `and`: ensure that all provided propType validators pass
   - `foo: and([number, nonNegativeInteger])`
 - `between`: provide an object with an `gt` or `gte` number, and an `lt` or `lte` number (only one item allowed from each pairs; one or both pairs may be provided), and the resulting propType validator will ensure the prop value is a number within the given range. Alternatively, you can provide a function that takes the `props` object and returns a number for each of the `gt`/`gte`/`lt`/`lte` values.
   - `foo: between({ gte: 0, lte: 5 })`
   - `foo: between({ gt: 0, lt: 5 })`
 - `booleanSome`: provide a list of props, and all must be booleans, and at least one of them must be `true`.
   - `foo: booleanSome('small', 'medium', 'large')`
 - `childrenHavePropXorChildren`: ensure that either all children have the indicated prop, all children have children, or all children have neither.
   - `foo: childrenHavePropXorChildren('bar')`
 - `childrenOf`: restrict the children prop to only allow children that pass the given propType validator.
   - `children: childrenOf(number.isRequired)`
 - `childrenOfType`: restrict the children prop to only allow children of the given element types - takes a Component, an HTML tag name, or `"*"` to match everything.
   - `children: childrenOfType('span')`
   - `children: childrenOfType(Component)`
 - `childrenSequenceOf`: restrict the children prop to be a sequenceOf the given "specifiers" (see `sequenceOf`)
   - `children: childrenSequenceOf({validator: string, min: 0, max: 5})`
 - `componentWithName`: restrict the prop to only allow a component with a certain name/displayName. Accepts a string, or a regular expression. Also accepts an `options` object with an optional `stripHOCs` array of string HOC names to strip off before validating; an HOC name must not contain parentheses and must be in camelCase.
   - `foo: componentWithName('Component')`
   - `foo: componentWithName('Component', { stripHOCs: ['withDirection', 'withStyles'] })`
 - `disallowedIf`: restrict the prop from being provided if the given other prop name matches the given other prop type. The other prop type validator only applies if the other prop name is not a null value.
   - `foo: disallowedIf(string, 'bar', bool)`
 - `elementType`: require that the prop be a specific type of React element - takes a Component, an HTML tag name, or `"*"` to match everything.
   - `foo: elementType('span')`
   - `foo: elementType(Component)`
 - `empty`: a value that React renders to nothing: `undefined`, `null`, `false`, the empty string, or an array of those things.
   - `foo: empty()`
 - `explicitNull`: only allow `null` or `undefined`/omission - and only `null` when required.
   - `foo: explicitNull()`
 - `forbidExtraProps`: pass your entire `propTypes` object into this function, and any nonspecified prop will error.
   - `Component.propTypes = forbidExtraProps({foo: number.isRequired})`
 - `integer`: require the prop be an integer.
   - `foo: integer()`
 - `keysOf`: pass in a proptype, and require all the keys of a prop to have that type
   - `foo: keysOf(number)`
 - `mutuallyExclusiveProps`: provide a propType, and a list of props, and only one prop out of the list will be permitted, validated by the given propType.
   - `foo: mutuallyExclusiveProps(bool, 'bar', 'sna')`
 - `mutuallyExclusiveTrueProps`: provide a list of props, and all must be booleans, and only one is allowed to be true.
   - `foo: mutuallyExclusiveTrueProps('bar', 'sna')`
 - `nChildren`: require a specific amount of children.
   - `children: nChildren(3)`
   - `children: nChildren(3, childrenOfType('span'))`
 - `nonNegativeInteger`: require that the prop be a number, that is 0, or a finite positive integer.
   - `foo: nonNegativeInteger()`
 - `nonNegativeNumber`: require that the prop be a number, that is 0, or a finite positive number.
   - `foo: nonNegativeNumber()`
 - `numericString`: require the prop be a string that is conceptually numeric.
   - `foo: numericString()`
 - `object`: same as `PropTypes.object`, but can be called outside of React's propType flow.
 - `or`: recursively allows only the provided propTypes, or arrays of those propTypes.
   - `foo: or([bool.isRequired, explicitNull()])`
 - `range`: provide a min, and a max, and the prop must be an integer in the range `[min, max)`
   - `foo: range(-1, 2)`
 - `ref`: require the prop to be a React ref. These can be either the object returned from `React.createRef()` or "callback" refs.
   - `foo: ref()`
 - `requiredBy`: pass in a prop name and propType, and require that the prop is defined and is not its default value if the passed in prop name is truthy. if the default value is not provided, defaults to checking against `null`.
   - `foo: requiredBy('bar', bool)`
 - `restrictedProp`: this prop is not permitted to be anything but `null` or `undefined`.
   - `foo: restrictedProp()`
   - `foo: restrictedProp(new TypeError('Custom Error'))`
 - `sequenceOf`: takes 1 or more "specifiers": an object with a "validator" function (a propType validator), a "min" nonNegativeInteger, and a "max" nonNegativeInteger. If both "min" and "max" may be omitted, they default to 1; if only "max" is omitted, it defaults to Infinity; if only "min" is omitted, it defaults to 1.
   - `foo: sequenceOf({validator: string, min: 0, max: 5})`
 - `shape`: takes a shape, and allows it to be enforced on any non-null/undefined value.
   - `foo: shape({ length: oneOf([2]) })`
 - `stringEndsWith`: takes a non-empty string, and returns a validator that ensures the prop value is a string that ends with it.
   - `foo: stringEndsWith('.png')`
 - `stringStartsWith`: takes a non-empty string, and returns a validator that ensures the prop value is a string that starts with it.
   - `foo: stringStartsWith('prefix-')`
 - `uniqueArray`: this prop must be an array, and all values must be unique (determined by `Object.is`). Like `PropTypes.array`, but with uniqueness.
   - `foo: uniqueArray()`
 - `uniqueArrayOf`: `uniqueArray`, with a type validator applied. Like `PropTypes.arrayOf`, but with uniqueness. Can also take an optional mapper function that allows for a non-standard unique calculation (otherwise, `Object.is` is used by default). The function is applied to each element in the array, and the resulting values are compared using the standard unique calculation.
   - `foo: uniqueArrayOf(number)`
   - `foo: uniqueArrayOf(element => element ** 2)`
   - `foo: uniqueArrayOf(element => element ** 2, 'test')`
   - `foo: uniqueArrayOf(array, element => element[0] ** 2, 'test')`
 - `valuesOf`: a non-object requiring `PropTypes.objectOf`. Takes a propType validator, and applies it to every own value on the propValue.
   - `foo: valuesOf(number)`
 - `withShape`: takes a PropType and a shape, and allows it to be enforced on any non-null/undefined value.
   - `foo: withShape(array, { length: oneOf([2]) })`

## Production
Since `PropTypes` are typically not included in production builds of React, this library’s functionality serves no useful purpose. As such, when the `NODE_ENV` environment variable is `"production"`, instead of exporting the implementations of all these prop types, we export mock functions - in other words, something that ensures that no exceptions are thrown, but does no validation. When environment variables are inlined (via a browserify transform or webpack plugin), then tools like webpack or uglify are able to determine that only the mocks will be imported - and can avoid including the entire implementations in the final bundle that is sent to the browser. This allows for a much smaller ultimate file size, and faster in-browser performance, without sacrificing the benefits of `PropTypes` themselves.

## Tests
Clone the repo, `npm install`, `npm run react`, and run `npm test`

[package-url]: https://npmjs.org/package/airbnb-prop-types
[npm-version-svg]: http://versionbadg.es/airbnb/prop-types.svg
[travis-svg]: https://travis-ci.org/airbnb/prop-types.svg
[travis-url]: https://travis-ci.org/airbnb/prop-types
[deps-svg]: https://david-dm.org/airbnb/prop-types.svg
[deps-url]: https://david-dm.org/airbnb/prop-types
[dev-deps-svg]: https://david-dm.org/airbnb/prop-types/dev-status.svg
[dev-deps-url]: https://david-dm.org/airbnb/prop-types#info=devDependencies
[npm-badge-png]: https://nodei.co/npm/airbnb-prop-types.png?downloads=true&stars=true
[license-image]: http://img.shields.io/npm/l/airbnb-prop-types.svg
[license-url]: LICENSE
[downloads-image]: http://img.shields.io/npm/dm/airbnb-prop-types.svg
[downloads-url]: http://npm-stat.com/charts.html?package=airbnb-prop-types
