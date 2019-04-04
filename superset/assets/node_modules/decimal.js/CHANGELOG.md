#### 9.0.1
* 15/12/2017
* #80 Typings: correct return type.

#### 9.0.0
* 14/12/2017
* #78 Typings: remove `toFormat`.

#### 8.0.0
* 10/12/2017
* Correct typings: `toFraction` returns `Decimal[]`.
* Type-checking: add `Decimal.isDecimal` method.
* Enable configuration reset with `defaults: true`.
* Add named export, Decimal, to *decimal.mjs*.

#### 7.5.1
* 03/12/2017
* Remove typo.

#### 7.5.0
* 03/12/2017
* Use TypeScript declarations outside modules.

#### 7.4.0
* 25/11/2017
* Add TypeScript typings.

#### 7.3.0
* 26/09/2017
* Rename *decimal.es6.js* to *decimal.mjs*.
* Amend  *.travis.yml*.

#### 7.2.4
* 09/09/2017
* Update docs regarding `global.crypto`.
* Fix `import` issues.

#### 7.2.3
* 27/06/2017
* Bugfix: #58 `pow` sometimes throws when result is `Infinity`.

#### 7.2.2
* 25/06/2017
* Bugfix: #57 Powers of -1 for integers over `Number.MAX_SAFE_INTEGER`.

#### 7.2.1
* 04/05/2017
* Fix *README* badges.

#### 7.2.0
* 09/04/2017
* Add *decimal.es6.js*

#### 7.1.2
* 05/04/2017
* `Decimal.default` to `Decimal['default']` IE8 issue

#### 7.1.1
* 10/01/2017
* Remove duplicated for-loop
* Minor refactoring

#### 7.1.0
* 09/11/2016
* Support ES6 imports.

#### 7.0.0
* 09/11/2016
* Remove `require('crypto')` - leave it to the user
* Default `Decimal.crypto` to `false`
* Add `Decimal.set` as `Decimal.config` alias

#### 6.0.0
* 30/06/2016
* Removed base-88 serialization format
* Amended `toJSON` and removed `Decimal.fromJSON` accordingly

#### 5.0.8
* 09/03/2016
* Add newline to single test results
* Correct year

#### 5.0.7
* 29/02/2016
* Add decimal.js-light link
* Remove outdated example from docs

#### 5.0.6
* 22/02/2016
* Add bower.json

#### 5.0.5
* 20/02/2016
* Bugfix: #26 wrong precision applied

#### 5.0.4
* 14/02/2016
* Bugfix: #26 clone

#### 5.0.3
* 06/02/2016
* Refactor tests

#### 5.0.2
* 05/02/2016
* Added immutability tests
* Minor *decimal.js* clean-up

#### 5.0.1
* 28/01/2016
* Bugfix: #20 cos mutates value
* Add pi info to docs

#### 5.0.0
* 25/01/2016
* Added trigonometric functions and `cubeRoot` method
* Added most of JavaScript's `Math` object methods as Decimal methods
* Added `toBinary`, `toHexadecimal` and `toOctal` methods
* Added `isPositive` method
* Removed the 15 significant digit limit for numbers
* `toFraction` now returns an array of two Decimals, not two strings
* String values containing whitespace or a plus sign are no longer accepted
* `valueOf` now returns `'-0'` for minus zero
* `comparedTo` now returns `NaN` not `null` for comparisons with `NaN`
* `Decimal.max` and `Decimal.min` no longer accept an array
* The Decimal constructor and `toString` no longer accept a base argument
* Binary, hexadecimal and octal prefixes are now recognised for string values
* Removed `Decimal.errors` configuration property
* Removed `toFormat` method
* Removed `Decimal.ONE`
* Renamed `exponential` method to `naturalExponential`
* Renamed `Decimal.constructor` method to `Decimal.clone`
* Simplified error handling and amended error messages
* Refactored the test suite
* `Decimal.crypto` is now `undefined` by default, and the `crypto` object will be used if available
* Major internal refactoring
* Removed *bower.json*

#### 4.0.2
* 20/02/2015 Add bower.json. Add source map. Amend travis CI. Amend doc/comments

#### 4.0.1
* 11/12/2014 Assign correct constructor when duplicating a Decimal

#### 4.0.0
* 10/11/2014 `toFormat` amended to use `Decimal.format` object for more flexible configuration

#### 3.0.1
* 8/06/2014 Surround crypto require in try catch. See issue #5

#### 3.0.0
* 4/06/2014 `random` simplified. Major internal changes mean the properties of a Decimal must now be considered read-only

#### 2.1.0
* 4/06/2014 Amend UMD

#### 2.0.3
* 8/05/2014 Fix NaN toNumber

#### 2.0.2
* 30/04/2014 Correct doc links

#### 2.0.1
* 10/04/2014 Update npmignore

#### 2.0.0
* 10/04/2014 Add `toSignificantDigits`
* Remove `toInteger`
* No arguments to `ceil`, `floor`, `round` and `trunc`

#### 1.0.1
* 07/04/2014 Minor documentation clean-up

#### 1.0.0
* 02/04/2014 Initial release
