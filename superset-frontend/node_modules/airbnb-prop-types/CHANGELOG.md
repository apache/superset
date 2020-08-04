2.15.0 / 2019-08-13
==================
  * [New] [getComponentName] Add logic to handle React.memo (#65)
  * [Deps] update `react-is`
  * [Dev Deps] update `enzyme-adapter-react-helper`, `eslint`, `eslint-config-airbnb`, `rimraf`, `safe-publish-latest`
  * [Tests] actually run `npm run test:prepare` in node >= 4
  * [Tests] up to `node` `v12`

2.14.0 / 2019-07-28
==================
  * [New] add `stringEndsWith` (#59)
  * [Fix] `getComponentName`/`componentWithName`: get display name from forwardRefs (#64)
  * [Docs] Conform disallowedIf file to lint. Update disallowedIf documentation (#62)
  * [Docs] add stringEndsWith to README.md (#60)
  * [Deps] update `array.prototype.find`, `function.prototype.name`
  * [Dev Deps] update `@babel/cli`, `@babel/core`, `@babel/register`, `babel-plugin-istanbul`, `babel-preset-airbnb`, `enzyme`, `enzyme-adapter-react-helper`, `eslint-config-airbnb`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`
  * [Tests] fix some broken tests

2.13.2 / 2019-04-08
==================
  * [patch] `ref`: Remove arity check (#57)

2.13.1 / 2019-04-06
==================
  * [Fix] `ref`: ensure that the prop value is not a component (#55)

2.13.0 / 2019-04-04
==================
  * [New] add `ref` (#54)
  * [Deps] update `prop-types`, `react-is`
  * [Dev Deps] update `@babel/cli`, `@babel/core`, `@babel/register`, `airbnb-browser-shims`, `babel-plugin-istanbul`, `babel-preset-airbnb`, `enzyme`, `enzyme-adapter-react-helper`, `eslint`

2.12.0 / 2019-02-09
==================
  * [New] add `empty`
  * [New] `elementType`: support forwardRefs and Context Provider/Consumer
  * [Deps] update `object.entries`
  * [Dev Deps] update to babel 7; update `airbnb-browser-shims`, `chai`, `enzyme`, `enzyme`, `enzyme-adapter-react-helper`, `eslint`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `eslint-plugin-import`

2.11.0 / 2018-09-04
==================
  * [New] Add disallowedIf propType (#45)
  * [Deps] update `has`, `prop-types`, `prop-types-exact`
  * [Dev Deps] update `enzyme`, `enzyme-adapter-react-helper`, `eslint`, `eslint-config-airbnb`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `safe-publish-latest`

2.10.0 / 2018-05-14
==================
  * [New] `componentWithName`: allow it to take a list of HOC names to strip off before validating (#41)
  * [Docs] add docs for 2 newest validators
  * [Dev Deps] update `eslint-plugin-import`, `eslint-plugin-react`
  * [Tests] on `node` `v10`

2.9.0 / 2018-04-10
==================
  * [New] Added `requiredBy` validator (#30)
  * [New] add `stringStartsWith`
  * [New] add `booleanSome`
  * [Fix] use `object-is` instead of `Object.is`
  * [Deps] update `prop-types`, `function.prototype.name`, `object.assign`, `prop-types-exact`
  * [Dev Deps] update `airbnb-browser-shims`, `babel-cli`, `babel-plugin-istanbul`, `babel-plugin-transform-replace-object-assign`, `babel-register`, `chai`, `eslint`, `eslint-config-airbnb`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `eslint-plugin-import`, `react`, `rimraf`
  * [Docs] fix URLs in readme
  * [Docs] fix range documentation (#33)
  * [Docs] Add simple use cases (#38)
  * [Tests] add `node` `v9`; pin included builds to LTS; use `nvm install-latest-npm`
  * [Tests] use `enzyme-adapter-react-helper`

2.8.1 / 2017-08-09
==================
  * [Fix] `nonNegativeInteger`: mock should match reality and not be a noopThunk, only a noop

2.8.0 / 2017-07-26
==================
  * [New] add optional `mapper` function to `uniqueArrayOf` (#29, #28)
  * [Deps] update `function.prototype.name`
  * [Dev Deps] update `eslint`, `eslint-config-airbnb`

2.7.1 / 2017-07-13
==================
  * [Fix] Make `getComponentName` more robust in IE (#27)
  * [Deps] update `prop-types-exact`
  * [Dev Deps] update `babel-preset-airbnb`, `chai`, `eslint-plugin-airbnb`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`

2.7.0 / 2017-06-25
==================
  * [New] Added compatibility for React 16 alpha (#25)

2.6.1 / 2017-06-12
==================
  * [Fix] `restrictedProp`: ensure it passes with a custom message when nullary

2.6.0 / 2017-06-09
==================
  * [New] `restrictedProp`: add ability to overwrite error with custom function (#22)
  * [Refactor] Allow object rest/spread and `Object.assign` by transforming to `object.assign`
  * [Deps] update `prop-types`
  * [Dev Deps] update `babel-plugin-istanbul`, `chai`, `eslint-config-airbnb`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `mocha`
  * [Tests] on `node` `v8`; `npm` `v5`+ breaks on `node` < v4
  * [Tests] greenkeeper-ignore `nyc`

2.5.4 / 2017-05-11
==================
  * [Fix] `childrenHavePropXorChildren` Ensure validator skips over falsy children
  * [Deps] update `prop-types`
  * [Dev Deps] update `babel-plugin-istanbul`, `mocha`, `nyc`, `react`

2.5.3 / 2017-04-08
==================
  * [Refactor] Use `prop-types` package instead of `React.PropTypes`
  * [Deps] update `array.prototype.find`, `prop-types`
  * [Dev Deps] update `babel-cli`, `babel-register`, `eslint`, `nyc`, `react`
  * [Tests] improve test matrix

2.5.2 / 2017-03-27
==================
  * [Fix] remove requirement to polyfill

2.5.1 / 2017-03-24
==================
  * [Fix] `componentWithName`: throw if given a non-string/non-regex name
  * [Fix] `or`: ensure it works with `explicitNull` (#12)
  * [Fix] `between`: avoid React PropType warning by using `valuesOf` instead of `PropTypes.objectOf`
  * [Refactor] `or`: add some extra tests; remove unnecessary `oneOfType` wrapper
  * [Tests] fail tests on console warnings or errors

2.5.0 / 2017-03-23
==================
  * [New] Adds regex capabilities to componentWithName (#11)
  * [New] `childrenOfType`: add support for `*` which supports anything.
  * [Dev Deps] update `babel-cli`, `babel-register`, `eslint`, `rimraf`, `babel-plugin-istanbul`, `eslint-plugin-react`
  * [Tests] improve coverage to 100%

2.4.1 / 2017-03-04
==================
  * [Fix] `childrenOfType`: partially revert fc0e37f84e1537a875c30d0db69b5121d790eb40

2.4.0 / 2017-03-04
==================
  * [New] add `childrenSequenceOf`
  * [New] add `sequenceOf`
  * [New] `between`: allow it to take props-taking number thunks as option values as well.
  * [New] add `between`
  * [New] add `shape`
  * [New] add `nonNegativeNumber`
  * [New] add `elementType`
  * [New] add `childrenOf`
  * [New] add `object`
  * [New] add `keysOf` (#8)
  * [New] add `valuesOf`
  * [New] add `isPrimitive` and `isPlainObject` helpers
  * [New] add `wrapValidator` helper
  * [New] add `renderableChildren` helper
  * [New] add `getComponentName` helper
  * [New] `nChildren`, `restrictedProp`, `childrenHavePropXorChildren`: add `isRequired` for consistency
  * [New] `and`: `isRequired` validator typeName should indicate such.
  * [Tests] run coverage as part of tests
  * [Tests] fix test script
  * [Tests] improve coverage to 100%
  * [Tests] add `npm run coverage`
  * [babel] build with source maps

2.3.0 / 2017-02-23
==================
  * [New] add `integer`
  * [Dev Deps] update `eslint`, `rimraf`

2.2.0 / 2017-02-16
==================
  * [New] add `numericString`
  * [New] add `explicitNull`
  * [Dev Deps] update `airbnb-js-shims`, `babel-cli`, `babel-register`, `eslint-plugin-react`

2.1.1 / 2017-02-09
==================
  * [Fix] `childrenOfType`: improve the error message
  * [Dev Deps] update `eslint`, `eslint-config-airbnb`, `eslint-plugin-jsx-a11y`

2.1.0 / 2017-02-01
==================
  * [New] add `mutuallyExclusiveTrueProps`
  * [Dev Deps] update `babel-cli`, `babel-preset-airbnb`, `babel-register`, `eslint`

2.0.1 / 2017-01-27
==================
  * [Fix] ensure production mocks have `.isRequired`

2.0.0 / 2017-01-09
==================
  * [breaking] when `NODE_ENV` is `production`, export mocks instead of real validators
  * [new] add mocks
  * [New] add `uniqueArray`/`uniqueArrayOf`
  * [New] add `withShape`
  * [Breaking] ensure every export is a function that returns a validator, for consistency (`restrictedProp`)
  * [Deps] move `safe-publish-latest` to devDeps
  * [Dev Deps] update `eslint`, `eslint-config-airbnb`, `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `mocha`, `react`; add missing `babel-register`
  * [Tests] on `node` `v7`

1.3.2 / 2016-10-27
==================
  * [enhancement] `forbidExtraProps`: add the componentName into the error message

1.3.1 / 2016-10-25
==================
  * [Fix] `forbidPropTypes`: allow propTypes to be processed multiple times
  * [Fix] `forbidPropTypes`: fix unknown props error message

1.3.0 / 2016-10-24
==================
  * [New] add `forbidExtraProps`
  * [Dev Deps] update `babel-cli`

1.2.0 / 2016-10-11
==================
  * [New] add `and` combinator
  * [New] add `isRequired` to `nonNegativeInteger`
  * [Dev Deps] update `eslint-plugin-react`, `mocha`

1.1.1 / 2016-10-09
==================
  * [Fix] `mutuallyExclusiveProps`: include the “current” prop in the exclusives list

1.1.0 / 2016-10-09
==================
  * [Fix] [New] add `isRequired` to `mutuallyExclusiveProps`; ensure `mutuallyExclusiveProps` is not required by default
  * [Fix] [New] add `isRequired` to `componentWithName`; ensure `componentWithName` is not required by default
  * [Deps] update `safe-publish-latest`

1.0.0 / 2016-10-08
==================
  * Initial release.
