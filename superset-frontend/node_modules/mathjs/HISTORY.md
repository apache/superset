# History

## 2018-02-07, version 3.20.2

- Upgraded to `typed-function@0.10.7` (bug-fix release).
- Fixed option `implicit` not being copied from an `OperatorNode`
  when applying function `map`. Thanks @HarraySarson.
- Fixed #995: spaces and underscores not property being escaped
  in `toTex()`. Thanks @FSMaxB.


## 2018-01-17, version 3.20.1

- Fixed #1018: `simplifyCore` failing in some cases with parentheses.
  Thanks @firepick1.


## 2018-01-14, version 3.20.0

- Implement support for 3 or more arguments for operators `+` and `*` in
  `derivative`. Thanks @HarrySarson. See #1002. 
- Fixed `simplify` evalution of `simplify` of functions with more than two 
  arguments wrongly: `simplify('f(x, y, z)') evaluated to `f(f(x, y), z)`
  instead of `f(x, y, z)`. Thanks @joelhoover.
- Fixed `simplify` throwing an error in some cases when simplifying unknown
  functions, for example `simplify('f(4)')`. Thanks @joelhoover.
- Fixed #1013: `simplify` wrongly simplifing some expressions containing unary
  minus, like `0 - -x`. Thanks @joelhoover.
- Fixed an error in an example in the documentation of `xor`. Thanks @denisx.


## 2018-01-06, version 3.19.0

- Extended functions `distance` and `intersect` with support for BigNumbers.
  Thanks @ovk. 
- Improvements in function `simplify`: added a rule that allows combining 
  of like terms in embedded quantities. Thanks @joelhoover. 


## 2017-12-28, version 3.18.1

- Fixed #998: An issue with simplifying an expression containing a subtraction.
  Thanks @firepick1.


## 2017-12-16, version 3.18.0

- Implemented function `rationalize`. Thanks @paulobuchsbaum.
- Upgraded dependencies:
  ```
  decimal.js    7.2.3  →  9.0.1 (no breaking changes affecting mathjs) 
  fraction.js   4.0.2  →  4.0.4 
  tiny-emitter  2.0.0  →  2.0.2 
  ```
- Upgraded dev dependencies.
- Fixed #975: a wrong example in the docs of lusolve.
- Fixed #983: `pickRandom` returning an array instead of single value
  when input was an array with just one value. Clarified docs.
- Fixed #969: preven issues with yarn autoclean by renaming an
  interally used folder "docs" to "embeddedDocs".


## 2017-11-18, version 3.17.0

- Improved `simplify` for nested exponentiations. Thanks @IvanVergiliev.
- Fixed a security issue in `typed-function` allowing arbitrary code execution
  in the JavaScript engine by creating a typed function with JavaScript code
  in the name. Thanks Masato Kinugawa.
- Fixed a security issue where forbidden properties like constructor could be
  replaced by using unicode characters when creating an object. No known exploit,
  but could possibly allow arbitrary code execution. Thanks Masato Kinugawa.


## 2017-10-18, version 3.16.5

- Fixed #954: Functions `add` and `multiply` not working when
  passing three or more arrays or matrices.


## 2017-10-01, version 3.16.4

- Fixed #948, #949: function `simplify` returning wrong results or 
  running into an infinite recursive loop. Thanks @ericman314.
- Fixed many small issues in the embedded docs.  Thanks @Schnark.


## 2017-08-28, version 3.16.3

- Fixed #934: Wrong simplification of unary minus. Thanks @firepick1.
- Fixed #933: function `simplify` reordering operations. Thanks @firepick1.
- Fixed #930: function `isNaN` returning wrong result for complex 
  numbers having just one of their parts (re/im) being `NaN`.
- Fixed #929: `FibonacciHeap.isEmpty` returning wrong result.


## 2017-08-20, version 3.16.2

- Fixed #924: a regression in `simplify` not accepting the signature
  `simplify(expr, rules, scope)` anymore. Thanks @firepick1.
- Fixed missing parenthesis when stringifying expressions containing
  implicit multiplications (see #922). Thanks @FSMaxB.


## 2017-08-12, version 3.16.1

- For security reasons, type checking is now done in a more strict
  way using functions like `isComplex(x)` instead of duck type checking
  like `x && x.isComplex === true`.
- Fixed #915: No access to property "name".
- Fixed #901: Simplify units when calling `unit.toNumeric()`.
  Thanks @AlexanderBeyn.
- Fixed `toString` of a parsed expression tree containing an
  immediately invoked function assignment not being wrapped in
  parenthesis (for example `(f(x) = x^2)(4)`).


## 2017-08-06, version 3.16.0

- Significant performance improvements in `math.simplify`.
  Thanks @firepick1.
- Improved API for `math.simplify`, optionally pass a scope with
  variables which are resolved, see #907. Thanks @firepick1.
- Fixed #912: math.js didn't work on IE10 anymore (regression
  since 3.15.0).


## 2017-07-29, version 3.15.0

- Added support for the dollar character `$` in symbol names (see #895).
- Allow objects with prototypes as scope again in the expression parser,
  this was disabled for security reasons some time ago. See #888, #899.
  Thanks @ThomasBrierley.
- Fixed #846: Issues in the functions `map`, `forEach`, and `filter`
  when used in the expression parser:
  - Not being able to use a function assignment as inline expression
    for the callback function.
  - Not being able to pass an inline expression as callback for `map`
    and `forEach`.
  - Index and original array/matrix not passed in `map` and `filter`.


## 2017-07-05, version 3.14.2

- Upgraded to `fraction.js@4.0.2`
- Fixed #891 using BigNumbers not working in browser environments.


## 2017-06-30, version 3.14.1

- Reverted to `fraction.js@4.0.0`, there is an issue with `4.0.1`
  in the browser.


## 2017-06-30, version 3.14.0

- Implemented set methods `setCartesian`, `setDifference`,
  `setDistinct`, `setIntersect`, `setIsSubset`, `setPowerset`,
  `setSize`. Thanks @Nekomajin42.
- Implemented method `toHTML` on nodes. Thanks @Nekomajin42.
- Implemented `compareNatural` and `sort([...], 'natural')`.
- Upgraded dependencies to the latest versions:
  - `complex.js@2.0.4`
  - `decimal.js@7.2.3`
  - `fraction.js@4.0.1`
  - `tiny-emitter@2.0.0`
  - And all devDependencies.
- Fixed #865: `splitUnit` can now deal with round-off errors.
  Thanks @ericman314.
- Fixed #876: incorrect definition for unit `erg`. Thanks @pjhampton.
- More informative error message when using single quotes instead of
  double quotes around a string. Thanks @HarrySarson.


## 2017-05-27, version 3.13.3

- Fixed a bug in function `intersection` of line and plane.
  Thanks @viclai.
- Fixed security vulnerabilities.


## 2017-05-26, version 3.13.2

- Disabled function `chain` inside the expression parser for security
  reasons (it's not needed there anyway).
- Fixed #856: function `subset` not returning non-primitive scalars
  from Arrays correctly. (like `math.eval('arr[1]', {arr: [math.bignumber(2)]})`.
- Fixed #861: physical constants not available in the expression parser.


## 2017-05-12, version 3.13.1

- Fixed creating units with an alias not working within the expression
  parser.
- Fixed security vulnerabilities. Thanks Sam.


## 2017-05-12, version 3.13.0

- Command line application can now evaluate inline expressions
  like `mathjs 1+2`. Thanks @slavaGanzin.
- Function `derivative` now supports `abs`. Thanks @tetslee.
- Function `simplify` now supports BigNumbers. Thanks @tetslee.
- Prevent against endless loops in `simplify`. Thanks @tetslee.
- Fixed #813: function `simplify` converting small numbers to inexact
  Fractions. Thanks @tetslee.
- Fixed #838: Function `simplify` now supports constants like `e`.
  Thanks @tetslee.


## 2017-05-05, version 3.12.3

- Fixed security vulnerabilities. Thanks Dan and Sam.


## 2017-04-30, version 3.12.2

- Added a rocket trajectory optimization example.


## 2017-04-24, version 3.12.1

- Fixed #804
  - Improved handling of powers of `Infinity`. Thanks @HarrySarson.
  - Fixed wrong formatting of complex NaN.
- Fixed security vulnerabilities in the expression parser.
  Thanks Sam and Dan.


## 2017-04-17, version 3.12.0

- Implemented QR decomposition, function `math.qr`. Thanks @HarrySarson.
- Fixed #824: Calling `math.random()` freezes IE and node.js.


## 2017-04-08, version 3.11.5

- More security measures in the expression parser.
  WARNING: the behavior of the expression parser is now more strict,
  some undocumented features may not work any longer.
  - Accessing and assigning properties is now only allowed on plain
    objects, not on classes, arrays, and functions anymore.
  - Accessing methods is restricted to a set of known, safe methods.


## 2017-04-03, version 3.11.4

- Fixed a security vulnerability in the expression parser. Thanks @xfix.


## 2017-04-03, version 3.11.3

- Fixed a security vulnerability in the expression parser. Thanks @xfix.


## 2017-04-03, version 3.11.2

- Fixed a security vulnerability in the expression parser. Thanks @xfix.


## 2017-04-02, version 3.11.1

- Fixed security vulnerabilities in the expression parser.
  Thanks Joe Vennix and @xfix.


## 2017-04-02, version 3.11.0

- Implemented method Unit.toSI() to convert a unit to base SI units.
  Thanks @ericman314.
- Fixed #821, #822: security vulnerabilities in the expression parser.
  Thanks @comex and @xfix.


## 2017-03-31, version 3.10.3

- More security fixes related to the ones fixed in `v3.10.2`.


## 2017-03-31, version 3.10.2

- Fixed a security vulnerability in the expression parser allowing
  execution of arbitrary JavaScript. Thanks @CapacitorSet and @denvit.


## 2017-03-26, version 3.10.1

- Fixed `xgcd` for negative values. Thanks @litmit.
- Fixed #807: function transform of existing functions not being removed when
  overriding such a function.


## 2017-03-05, version 3.10.0

- Implemented function `reshape`. Thanks @patgrasso and @ericman314.
- Implemented configuration option `seedRandom` for deterministic random
  numbers. Thanks @morsecodist.
- Small fixes in the docs. Thanks @HarrySarson.
- Dropped support for component package manager (which became deprecated about
  one and a half year ago).


## 2017-02-22, version 3.9.3

- Fixed #797: issue with production builds of React Native projects.
- Fixed `math.round` not accepting inputs `NaN`, `Infinity`, `-Infinity`.
- Upgraded all dependencies.


## 2017-02-16, version 3.9.2

- Fixed #795: Parse error in case of a multi-line expression with just comments.


## 2017-02-06, version 3.9.1

- Fixed #789: Math.js not supporting conversion of `string` to `BigNumber`,
  `Fraction`, or `Complex` number.
- Fixed #790: Expression parser did not pass function arguments of enclosing
  functions via `scope` to functions having `rawArgs = true`.
- Small fixes in the docs. Thanks @HarrySarson.


## 2017-01-23, version 3.9.0

- Implemented support for algebra: powerful new functions `simplify` and
  `derivative`. Thanks @ericman314, @tetslee, and @BigFav.
- Implemented Kronecker Product `kron`. Thanks @adamisntdead.
- Reverted `FunctionNode` not accepting a string as function name anymore.
- Fixed #765: `FunctionAssignmentNode.toString()` returning a string
  incompatible with the function assignment syntax.


## 2016-12-15, version 3.8.1

- Implemented function `mad` (median absolute deviation). Thanks @ruhleder.
- Fixed #762: expression parser failing to invoke a function returned
  by a function.


## 2016-11-18, version 3.8.0

- Functions `add` and `multiply` now accept more than two arguments. See #739.
- `OperatorNode` now supports more than two arguments. See #739. Thanks @FSMaxB.
- Implemented a method `Node.cloneDeep` for the expression nodes. See #745.
- Fixed a bug in `Node.clone()` not cloning implicit multiplication correctly.
  Thanks @FSMaxB.
- Fixed #737: Improved algorithm determining the best prefix for units.
  It will now retain the original unit like `1 cm` when close enough,
  instead of returning `10 mm`. Thanks @ericman314.
- Fixed #732: Allow letter-like unicode characters like Ohm `\u2126`.
- Fixed #749: Units `rad`, `deg`, and `grad` can now have prefixes like `millirad`.
- Some fixes in the docs and comments of examples. Thanks @HarrySarson.


## 2016-11-05, version 3.7.0

- Implemented method `Node.equals(other)` for all nodes of the expression parser.
- Implemented BigNumber support in function `arg()`.
- Command Line Interface loads faster.
- Implicit conversions between Fractions and BigNumbers throw a neat error now
  (See #710).


## 2016-10-21, version 3.6.0

- Implemented function `erf()`. THanks @patgrasso.
- Extended function `cross()` to support n-d vectors. Thanks @patgrasso.
- Extended function `pickRandom` with the option to pick multiple values from
  an array and give the values weights: `pickRandom(possibles, number, weights)`.
  Thanks @woylie.
- Parser now exposes test functions like `isAlpha` which can be replaced in
  order to adjust the allowed characters in variables names (See #715).
- Fixed #727: Parser not throwing an error for invalid implicit multiplications
  like `-2 2` and `2^3 4` (right after the second value of an operator).
- Fixed #688: Describe allowed variable names in the docs.


## 2016-09-21, version 3.5.3

- Some more fixes regarding numbers ending with a decimal mark (like `2.`).


## 2016-09-20, version 3.5.2

- Fixed numbers ending with a decimal mark (like `2.`) not being supported by
  the parser, solved the underlying ambiguity in the parser. See #707, #711.


## 2016-09-12, version 3.5.1

- Removed a left over console.log statement. Thanks @eknkc.


## 2016-09-07, version 3.5.0

- Comments of expressions are are now stored in the parsed nodes. See #690.
- Fixed function `print` not accepting an Object with formatting options as
  third parameter Thanks @ThomasBrierley.
- Fixed #707: The expression parser no longer accepts numbers ending with a dot
  like `2.`.


## 2016-08-08, version 3.4.1

- Fixed broken bundle files (`dist/math.js`, `dist/math.min.js`).
- Fixed some layout issues in the function reference docs.


## 2016-08-07, version 3.4.0

- Implemented support for custom units using `createUnit`. Thanks @ericman314.
- Implemented function `splitUnits`. Thanks @ericman314.
- Implemented function `isPrime`. Thanks @MathBunny.


## 2016-07-05, version 3.3.0

- Implemented function `isNaN`.
- Function `math.filter` now passes three arguments to the callback function:
  value, index, and array.
- Removed the check on the number of arguments from functions defined in the
  expression parser (see #665).
- Fixed #665: functions `map`, `forEach`, and `filter` now invoke callbacks
  which are a typed-function with the correct number of arguments.


## 2016-04-26, version 3.2.1

- Fixed #651: unable to perform calculations on "Unit-less" units.
- Fixed matrix.subset mutating the replacement matrix when unsqueezing it.


## 2016-04-16, version 3.2.0

- Implemented #644: method `Parser.getAll()` to retrieve all defined variables.
- Upgraded dependencies (decimal.js@5.0.8, fraction.js@3.3.1,
  typed-function@0.10.4).
- Fixed #601: Issue with unnamed typed-functions by upgrading to
  typed-function v0.10.4.
- Fixed #636: More strict `toTex` templates, reckon with number of arguments.
- Fixed #641: Bug in expression parser parsing implicit multiplication with
  wrong precedence in specific cases.
- Fixed #645: Added documentation about `engineering` notation of function
  `math.format`.


## 2016-04-03, version 3.1.4

- Using ES6 Math functions like `Math.sinh`, `Math.cbrt`, `Math.sign`, etc when
  available.
- Fixed #631: unit aliases `weeks`, `months`, and `years` where missing.
- Fixed #632: problem with escaped backslashes at the end of strings.
- Fixed #635: `Node.toString` options where not passed to function arguments.
- Fixed #629: expression parser throws an error when passing a number with
  decimal exponent instead of parsing them as implicit multiplication.
- Fixed #484, #555: inaccuracy of `math.sinh` for values between -1 and 1.
- Fixed #625: Unit `in` (`inch`) not always working due to ambiguity with
  the operator `a in b` (alias of `a to b`).


## 2016-03-24, version 3.1.3

- Fix broken bundle.


## 2016-03-24, version 3.1.2

- Fix broken npm release.


## 2016-03-24, version 3.1.1

- Fixed #621: a bug in parsing implicit multiplications like `(2)(3)+4`.
- Fixed #623: `nthRoot` of zero with a negative root returned `0` instead of
  `Infinity`.
- Throw an error when functions `min`, `max`, `mean`, or `median` are invoked
  with multiple matrices as arguments (see #598).


## 2016-03-19, version 3.1.0

- Hide multiplication operator by default when outputting `toTex` and `toString`
  for implicit multiplications. Implemented and option to output the operator.
- Implemented unit `kip` and alias `kips`. Thanks @hgupta9.
- Added support for prefixes for units `mol` and `mole`. Thanks @stu-blair.
- Restored support for implicit multiplications like `2(3+4)` and `(2+3)(4+5)`.
- Some improvements in the docs.
- Added automatic conversions from `boolean` and `null` to `Fraction`,
  and conversions from `Fraction` to `Complex`.


## 2016-03-04, version 3.0.0

### breaking changes

- More restricted support for implicit multiplication in the expression
  parser: `(...)(...)` is now evaluated as a function invocation,
  and `[...][...]` as a matrix subset.
- Matrix multiplication no longer squeezes scalar outputs to a scalar value,
  but leaves them as they are: a vector or matrix containing a single value.
  See #529.
- Assignments in the expression parser now return the assigned value rather
  than the created or updated object (see #533). Example:

  ```
  A = eye(3)
  A[1,1] = 2   # this assignment now returns 2 instead of A
  ```

- Expression parser now supports objects. This involves a refactoring and
  extension in expression nodes:
  - Implemented new node `ObjectNode`.
  - Refactored `AssignmentNode`, `UpdateNode`, and `IndexNode` are refactored
    into `AccessorNode`, `AssignmentNode`, and `IndexNode` having a different API.
- Upgraded the used BigNumber library `decimal.js` to v5. Replaced the
  trigonometric functions of math.js with those provided in decimal.js v5.
  This can give slightly different behavior qua round-off errors.
- Replaced the internal `Complex.js` class with the `complex.js` library
  created by @infusion.
- Entries in a matrix (typically numbers, BigNumbers, Units, etc) are now
  considered immutable, they are no longer copied when performing operations on
  the entries, improving performance.
- Implemented nearly equal comparison for relational functions (`equal`,
  `larger`, `smaller`, etc.) when using BigNumbers.
- Changed the casing of the configuration options `matrix` (`Array` or `Matrix`)
  and `number` (`number`, `BigNumber`, `Fraction`) such that they now match
  the type returned by `math.typeof`. Wrong casing gives a console warning but
  will still work.
- Changed the default config value for `epsilon` from `1e-14` to `1e-12`,
  see #561.

### non-breaking changes

- Extended function `pow` to return the real root for cubic roots of negative
  numbers. See #525, #482, #567.
- Implemented support for JSON objects in the expression parser and the
  function `math.format`.
- Function `math.fraction` now supports `BigNumber`, and function
  `math.bignumber` now supports `Fraction`.
- Expression parser now allows function and/or variable assignments inside
  accessors and conditionals, like `A[x=2]` or `a > 2 ? b="ok" : b="fail"`.
- Command line interface:
  - Outputs the variable name of assignments.
  - Fixed not rounding BigNumbers to 14 digits like numbers.
  - Fixed non-working autocompletion of user defined variables.
- Reorganized and extended docs, added docs on classes and more. Thanks @hgupta9.
- Added new units `acre`, `hectare`, `torr`, `bar`, `mmHg`, `mmH2O`, `cmH2O`,
  and added new aliases `acres`, `hectares`, `sqfeet`, `sqyard`, `sqmile`,
  `sqmiles`, `mmhg`, `mmh2o`, `cmh2o`. Thanks @hgupta9.
- Fixed a bug in the toString method of an IndexNode.
- Fixed angle units `deg`, `rad`, `grad`, `cycle`, `arcsec`, and `arcmin` not
  being defined as BigNumbers when configuring to use BigNumbers.


## 2016-02-03, version 2.7.0

- Added more unit aliases for time: `secs`, `mins`, `hr`, `hrs`. See #551.
- Added support for doing operations with mixed `Fractions` and `BigNumbers`.
- Fixed #540: `math.intersect()` returning null in some cases. Thanks @void42.
- Fixed #546: Cannot import BigNumber, Fraction, Matrix, Array.
  Thanks @brettjurgens.


## 2016-01-08, version 2.6.0

- Implemented (complex) units `VA` and `VAR`.
- Implemented time units for weeks, months, years, decades, centuries, and 
  millennia. Thanks @owenversteeg.
- Implemented new notation `engineering` in function `math.format`. 
  Thanks @johnmarinelli.
- Fixed #523: In some circumstances, matrix subset returned a scalar instead 
  of the correct subset.
- Fixed #536: A bug in an internal method used for sparse matrices.


## 2015-12-05, version 2.5.0

- Implemented support for numeric types `Fraction` and `BigNumber` in units.
- Implemented new method `toNumeric` for units.
- Implemented new units `arcsec`, `arcsecond`, `arcmin`, `arcminute`. 
  Thanks @devdevdata222.
- Implemented new unit `Herts` (`Hz`). Thanks @SwamWithTurtles.
- Fixed #485: Scoping issue with variables both used globally as well as in a 
  function definition.
- Fixed: Function `number` didn't support `Fraction` as input.


## 2015-11-14, version 2.4.2

- Fixed #502: Issue with `format` in some JavaScript engines.
- Fixed #503: Removed trailing commas and the use of keyword `import` as 
  property, as this gives issues with old JavaScript engines.


## 2015-10-29, version 2.4.1

- Fixed #480: `nthRoot` not working on Internet Explorer (up to IE 11).
- Fixed #490: `nthRoot` returning an error for negative values like 
  `nthRoot(-2, 3)`.
- Fixed #489: an issue with initializing a sparse matrix without data.
  Thanks @Retsam.
- Fixed: #493: function `combinations` did not throw an exception for 
  non-integer values of `k`.
- Fixed: function `import` did not override typed functions when the option
  override was set true.
- Fixed: added functions `math.sparse` and `math.index` to the reference docs, 
  they where missing.
- Fixed: removed memoization from `gamma` and `factorial` functions, this 
  could blow up memory.


## 2015-10-09, version 2.4.0

- Added support in the expression parser for mathematical alphanumeric symbols 
  in the expression parser: unicode range \u{1D400} to \u{1D7FF} excluding 
  invalid code points.
- Extended function `distance` with more signatures. Thanks @kv-kunalvyas.
- Fixed a bug in functions `sin` and `cos`, which gave wrong results for 
  BigNumber integer values around multiples of tau (i.e. `sin(bignumber(7))`).
- Fixed value of unit `stone`. Thanks @Esvandiary for finding the error.


## 2015-09-19, version 2.3.0

- Implemented function `distance`. Thanks @devanp92.
- Implemented support for Fractions in function `lcm`. Thanks @infusion.
- Implemented function `cbrt` for numbers, complex numbers, BigNumbers, Units.
- Implemented function `hypot`.
- Upgraded to fraction.js v3.0.0.
- Fixed #450: issue with non sorted index in sparse matrices.
- Fixed #463, #322: inconsistent handling of implicit multiplication.
- Fixed #444: factorial of infinity not returning infinity.


## 2015-08-30, version 2.2.0

- Units with powers (like `m^2` and `s^-1`) now output with the best prefix.
- Implemented support for units to `abs`, `cube`, `sign`, `sqrt`, `square`.
  Thanks @ericman314.
- Implemented function `catalan` (Combinatorics). Thanks @devanp92.
- Improved the `canDefineProperty` check to return false in case of IE8, which
  has a broken implementation of `defineProperty`. Thanks @golmansax.
- Fixed function `to` not working in case of a simplified unit.
- Fixed #437: an issue with row swapping in `lup`, also affecting `lusolve`.


## 2015-08-12, version 2.1.1

- Fixed wrong values of the physical constants `speedOfLight`, `molarMassC12`,  
  and `magneticFluxQuantum`. Thanks @ericman314 for finding two of them.


## 2015-08-11, version 2.1.0

- Implemented derived units (like `110 km/h in m/s`). Thanks @ericman314.
- Implemented support for electric units. Thanks @ericman314.
- Implemented about 50 physical constants like `speedOfLight`, `gravity`, etc. 
- Implemented function `kldivergence` (Kullback-Leibler divergence). 
  Thanks @saromanov.
- Implemented function `mode`. Thanks @kv-kunalvyas.
- Added support for unicode characters in the expression parser: greek letters
  and latin letters with accents. See #265.
- Internal functions `Unit.parse` and `Complex.parse` now throw an Error 
  instead of returning null when passing invalid input.


## 2015-07-29, version 2.0.1

- Fixed operations with mixed fractions and numbers be converted to numbers
  instead of fractions.


## 2015-07-28, version 2.0.0

- Large internal refactoring:
  - performance improvements.
  - allows to create custom bundles
  - functions are composed using `typed-function` and are extensible
- Implemented support for fractions, powered by the library `fraction.js`.
- Implemented matrix LU decomposition with partial pivoting and a LU based 
  linear equations solver (functions `lup` and `lusolve`). Thanks @rjbaucells.
- Implemented a new configuration option `predictable`, which can be set to
  true in order to ensure predictable function output types.
- Implemented function `intersect`. Thanks @kv-kunalvyas.
- Implemented support for adding `toTex` properties to custom functions.
  Thanks @FSMaxB.
- Implemented support for complex values to `nthRoot`. Thanks @gangachris.
- Implemented util functions `isInteger`, `isNegative`, `isNumeric`, 
  `isPositive`, and `isZero`.

### breaking changes

- String input is now converted to numbers by default for all functions. 
- Adding two strings will no longer concatenate them, but will convert the 
  strings to numbers and add them.
- Function `index` does no longer accept an array `[start, end, step]`, but
  instead accepts an array with arbitrary index values. It also accepts
  a `Range` object as input.
- Function `typeof` no longer returns lower case names, but now returns lower
  case names for primitives (like `number`, `boolean`, `string`), and 
  upper-camel-case for non-primitives (like `Array`, `Complex`, `Function`).
- Function `import` no longer supports a module name as argument. Instead,
  modules can be loaded using require: `math.import(require('module-name'))`.
- Function `import` has a new option `silent` to ignore errors, and throws
  errors on duplicates by default.
- Method `Node.compile()` no longer needs `math` to be passed as argument.
- Reintroduced method `Node.eval([scope])`.
- Function `sum` now returns zero when input is an empty array. Thanks @FSMAxB.
- The size of Arrays is no longer validated. Matrices will validate this on
  creation.


## 2015-07-12, version 1.7.1

- Fixed #397: Inaccuracies in nthRoot for very large values, and wrong results 
  for very small values. (backported from v2)
- Fixed #405: Parser throws error when defining a function in a multiline 
  expression.


## 2015-05-31, version 1.7.0

- Implemented function `quantileSeq` and `partitionSelect`. Thanks @BigFav.
- Implemented functions `stirlingS2`, `bellNumbers`, `composition`, and 
  `multinomial`. Thanks @devanp92.
- Improved the performance of `median` (see #373). Thanks @BigFav.
- Extended the command line interface with a `mode` option to output either
  the expressions result, string representation, or tex representation.
  Thanks @FSMaxB.
- Fixed #309: Function median mutating the input matrix. Thanks @FSMaxB. 
- Fixed `Node.transform` not recursing over replaced parts of the 
  node tree (see #349).
- Fixed #381: issue in docs of `randomInt`.


## 2015-04-22, version 1.6.0

- Improvements in `toTex`. Thanks @FSMaxB.
- Fixed #328: `abs(0 + 0i)` evaluated to `NaN`.
- Fixed not being able to override lazy loaded constants.


## 2015-04-09, version 1.5.2

- Fixed #313: parsed functions did not handle recursive calls correctly.
- Fixed #251: binary prefix and SI prefix incorrectly used for byte. Now 
  following SI standards (`1 KiB == 1024 B`, `1 kB == 1000 B`).
- Performance improvements in parsed functions.


## 2015-04-08, version 1.5.1

- Fixed #316: a bug in rounding values when formatting.
- Fixed #317, #319: a bug in formatting negative values.


## 2015-03-28, version 1.5.0

- Added unit `stone` (6.35 kg).
- Implemented support for sparse matrices. Thanks @rjbaucells.
- Implemented BigNumber support for function `atan2`. Thanks @BigFav.
- Implemented support for custom LaTeX representations. Thanks @FSMaxB.
- Improvements and bug fixes in outputting parentheses in `Node.toString` and
  `Node.toTex` functions. Thanks @FSMaxB.
- Fixed #291: function `format` sometimes returning exponential notation when
  it should return a fixed notation.


## 2015-02-28, version 1.4.0

- Implemented trigonometric functions:
  `acosh`, `acoth`, `acsch`, `asech`, `asinh`, `atanh`, `acot`, `acsc`, `asec`.
  Thanks @BigFav.
- Added BigNumber support for functions: `cot`, `csc`, `sec`, `coth`,
  `csch`, `sech`. Thanks @BigFav.
- Implemented support for serialization and deserialization of math.js data
  types.
- Fixed the calculation of `norm()` and `abs()` for large complex numbers.
  Thanks @rjbaucells.
- Fixed #281: improved formatting complex numbers. Round the real or imaginary
  part to zero when the difference is larger than the configured precision.


## 2015-02-09, version 1.3.0

- Implemented BigNumber implementations of most trigonometric functions: `sin`,
  `cos`, `tan`, `asin`, `acos`, `atan`, `cosh`, `sinh`, `tanh`. Thanks @BigFav.
- Implemented function `trace`. Thanks @pcorey.
- Faster loading of BigNumber configuration with a high precision by lazy
  loading constants like `pi` and `e`.
- Fixed constants `NaN` and `Infinity` not being BigNumber objects when
  BigNumbers are configured.
- Fixed missing parentheses in the `toTex` representation of function
  `permutations`.
- Some minor fixes in the docs. Thanks @KenanY.


## 2014-12-25, version 1.2.0

- Support for bitwise operations `bitAnd`, `bitNot`, `bitOr`, `bitXor`,
  `leftShift`, `rightArithShift`, and `rightLogShift`. Thanks @BigFav.
- Support for boolean operations `and`, `not`, `or`, `xor`. Thanks @BigFav.
- Support for `gamma` function. Thanks @BigFav.
- Converting a unit without value will now result in a unit *with* value,
  i.e. `inch in cm` will return `2.54 cm` instead of `cm`.
- Improved accuracy of `sinh` and complex `cos` and `sin`. Thanks @pavpanchekha.
- Renamed function `select` to `chain`. The old function `select` will remain
  functional until math.js v2.0.
- Upgraded to decimal.js v4.0.1 (BigNumber library).


## 2014-11-22, version 1.1.1

- Fixed Unit divided by Number returning zero.
- Fixed BigNumber downgrading to Number for a negative base in `pow`.
- Fixed some typos in error messaging (thanks @andy0130tw) and docs.


## 2014-11-15, version 1.1.0

- Implemented functions `dot` (dot product), `cross` (cross product), and
  `nthRoot`.
- Officially opened up the API of expression trees:
  - Documented the API.
  - Implemented recursive functions `clone`, `map`, `forEach`, `traverse`,
    `transform`, and `filter` for expression trees.
  - Parameter `index` in the callbacks of `map` and `forEach` are now cloned
    for every callback.
  - Some internal refactoring inside nodes to make the API consistent:
    - Renamed `params` to `args` and vice versa to make things consistent.
    - Renamed `Block.nodes` to `Block.blocks`.
    - `FunctionNode` now has a `name: string` instead of a `symbol: SymbolNode`.
    - Changed constructor of `RangeNode` to
      `new RangeNode(start: Node, end: Node [, step: Node])`.
    - Nodes for a `BlockNode` must now be passed via the constructor instead
      of via a function `add`.
- Fixed `2e` giving a syntax error instead of being parsed as `2 * e`.


## 2014-09-12, version 1.0.1

- Disabled array notation for ranges in a matrix index in the expression parser 
  (it is confusing and redundant there).
- Fixed a regression in the build of function subset not being able to return
  a scalar.
- Fixed some missing docs and broken links in the docs.


## 2014-09-04, version 1.0.0

- Implemented a function `filter(x, test)`.
- Removed `math.distribution` for now, needs some rethinking.
- `math.number` can convert units to numbers (requires a second argument)
- Fixed some precedence issues with the range and conversion operators.
- Fixed an zero-based issue when getting a matrix subset using an index 
  containing a matrix.


## 2014-08-21, version 0.27.0

- Implemented functions `sort(x [, compare])` and `flatten(x)`.
- Implemented support for `null` in all functions.
- Implemented support for "rawArgs" functions in the expression parser. Raw 
  functions are invoked with unevaluated parameters (nodes).
- Expressions in the expression parser can now be spread over multiple lines,
  like '2 +\n3'.
- Changed default value of the option `wrap` of function `math.import` to false.
- Changed the default value for new entries in a resized matrix when to zero. 
  To leave new entries uninitialized, use the new constant `math.uninitialized` 
  as default value.
- Renamed transform property from `__transform__` to `transform`, and documented
  the transform feature.
- Fixed a bug in `math.import` not applying options when passing a module name.
- A returned matrix subset is now only squeezed when the `index` consists of
  scalar values, and no longer for ranges resolving into a single value. 


## 2014-08-03, version 0.26.0

- A new instance of math.js can no longer be created like `math([options])`,
  to prevent side effects from math being a function instead of an object.
  Instead, use the function `math.create([options])` to create a new instance.
- Implemented `BigNumber` support for all constants: `pi`, `tau`, `e`, `phi`,
  `E`, `LN2`, `LN10`, `LOG2E`, `LOG10E`, `PI`, `SQRT1_2`, and `SQRT2`.
- Implemented `BigNumber` support for functions `gcd`, `xgcd`, and `lcm`.
- Fixed function `gxcd` returning an Array when math.js was configured 
  as `{matrix: 'matrix'}`.
- Multi-line expressions now return a `ResultSet` instead of an `Array`.
- Implemented transforms (used right now to transform one-based indices to 
  zero-based for expressions).
- When used inside the expression parser, functions `concat`, `min`, `max`,
  and `mean` expect an one-based dimension number.
- Functions `map` and `forEach` invoke the callback with one-based indices
  when used from within the expression parser.
- When adding or removing dimensions when resizing a matrix, the dimensions
  are added/removed from the inner side (right) instead of outer side (left).
- Improved index out of range errors.
- Fixed function `concat` not accepting a `BigNumber` for parameter `dim`.
- Function `squeeze` now squeezes both inner and outer singleton dimensions.
- Output of getting a matrix subset is not automatically squeezed anymore
  except for scalar output.
- Renamed `FunctionNode` to `FunctionAssignmentNode`, and renamed `ParamsNode`
  to `FunctionNode` for more clarity.
- Fixed broken auto completion in CLI.
- Some minor fixes.


## 2014-07-01, version 0.25.0

- The library now immediately returns a default instance of mathjs, there is
  no need to instantiate math.js in a separate step unless one ones to set 
  configuration options: 
  
        // instead of:
        var mathjs = require('mathjs'),  // load math.js
            math = mathjs();             // create an instance
      
        // just do:
        var math = require('mathjs');
- Implemented support for implicit multiplication, like `math.eval('2a', {a:3})`
  and `math.eval('(2+3)(1-3)')`. This changes behavior of matrix indexes as 
  well: an expression like `[...][...]` is not evaluated as taking a subset of 
  the first matrix, but as an implicit multiplication of two matrices.
- Removed utility function `ifElse`. This function is redundant now the 
  expression parser has a conditional operator `a ? b : c`.
- Fixed a bug with multiplying a number with a temperature,  
  like `math.eval('10 * celsius')`.
- Fixed a bug with symbols having value `undefined` not being evaluated.


## 2014-06-20, version 0.24.1

- Something went wrong with publishing on npm.


## 2014-06-20, version 0.24.0

- Added constant `null`.
- Functions `equal` and `unequal` support `null` and `undefined` now.
- Function `typeof` now recognizes regular expressions as well.
- Objects `Complex`, `Unit`, and `Help` now return their string representation
  when calling `.valueOf()`.
- Changed the default number of significant digits for BigNumbers from 20 to 64.
- Changed the behavior of the conditional operator (a ? b : c) to lazy 
  evaluating.
- Fixed imported, wrapped functions not accepting `null` and `undefined` as
  function arguments.


## 2014-06-10, version 0.23.0

- Renamed some functions (everything now has a logical, camel case name):
  - Renamed functions `edivide`, `emultiply`, and `epow` to `dotDivide`, 
    `dotMultiply`, and `dotPow` respectively. 
  - Renamed functions `smallereq` and `largereq` to `smallerEq` and `largerEq`.
  - Renamed function `unary` to `unaryMinus` and added support for strings.
- `end` is now a reserved keyword which cannot be used as function or symbol
  name in the expression parser, and is not allowed in the scope against which
  an expression is evaluated.
- Implemented function `unaryPlus` and unary plus operator.
- Implemented function `deepEqual` for matrix comparisons. 
- Added constant `phi`, the golden ratio (`phi = 1.618...`).
- Added constant `version`, returning the version number of math.js as string.
- Added unit `drop` (`gtt`).
- Fixed not being able to load math.js using AMD/require.js.
- Changed signature of `math.parse(expr, nodes)` to `math.parse(expr, options)`
  where `options: {nodes: Object.<String, Node>}`
- Removed matrix support from conditional function `ifElse`.
- Removed automatic assignment of expression results to variable `ans`. 
  This functionality can be restored by pre- or postprocessing every evaluation, 
  something like:
  
        function evalWithAns (expr, scope) {
          var ans = math.eval(expr, scope);
          if (scope) {
            scope.ans = ans;
          }
          return ans;
        }


## 2014-05-22, version 0.22.0

- Implemented support to export expressions to LaTeX. Thanks Niels Heisterkamp
  (@nheisterkamp).
- Output of matrix multiplication is now consistently squeezed.
- Added reference documentation in the section /docs/reference.
- Fixed a bug in multiplying units without value with a number (like `5 * cm`).
- Fixed a bug in multiplying two matrices containing vectors (worked fine for 
  arrays).
- Fixed random functions not accepting Matrix as input, and always returning
  a Matrix as output.


## 2014-05-13, version 0.21.1

- Removed `crypto` library from the bundle.
- Deprecated functions `Parser.parse` and `Parser.compile`. Use
  `math.parse` and `math.compile` instead.
- Fixed function `add` not adding strings and matrices element wise.
- Fixed parser not being able to evaluate an exponent followed by a unary minus
  like `2^-3`, and a transpose followed by an index like `[3]'[1]`.


## 2014-04-24, version 0.21.0

- Implemented trigonometric hyperbolic functions `cosh`, `coth`, `csch`,
  `sech`, `sinh`, `tanh`. Thanks Rogelio J. Baucells (@rjbaucells).
- Added property `type` to all expression nodes in an expression tree.
- Fixed functions `log`, `log10`, `pow`, and `sqrt` not supporting complex
  results from BigNumber input (like `sqrt(bignumber(-4))`).


## 2014-04-16, version 0.20.0

- Switched to module `decimal.js` for BigNumber support, instead of
  `bignumber.js`.
- Implemented support for polar coordinates to the `Complex` datatype.
  Thanks Finn Pauls (@finnp).
- Implemented BigNumber support for functions `exp`, `log`, and `log10`.
- Implemented conditional operator `a ? b : c` in expression parser.
- Improved floating point comparison: the functions now check whether values
  are nearly equal, against a configured maximum relative difference `epsilon`.
  Thanks Rogelio J. Baucells (@rjbaucells).
- Implemented function `norm`. Thanks Rogelio J. Baucells (@rjbaucells).
- Improved function `ifElse`, is now specified for special data types too.
- Improved function `det`. Thanks Bryan Cuccioli (@bcuccioli).
- Implemented `BigNumber` support for functions `det` and `diag`.
- Added unit alias `lbs` (pound mass).
- Changed configuration option `decimals` to `precision` (applies to BigNumbers
  only).
- Fixed support for element-wise comparisons between a string and a matrix.
- Fixed: expression parser now trows IndexErrors with one-based indices instead
  of zero-based.
- Minor bug fixes.


## 2014-03-30, version 0.19.0

- Implemented functions `compare`, `sum`, `prod`, `var`, `std`, `median`.
- Implemented function `ifElse` Thanks @mtraynham.
- Minor bug fixes.


## 2014-02-15, version 0.18.1

- Added unit `feet`.
- Implemented function `compile` (shortcut for parsing and then compiling).
- Improved performance of function `pow` for matrices. Thanks @hamadu.
- Fixed broken auto completion in the command line interface.
- Fixed an error in function `combinations` for large numbers, and
  improved performance of both functions `combinations` and `permutations`.


## 2014-01-18, version 0.18.0

- Changed matrix index notation of expression parser from round brackets to
  square brackets, for example `A[1, 1:3]` instead of `A(1, 1:3)`.
- Removed need to use the `function` keyword for function assignments in the
  expression parser, you can define a function now like `f(x) = x^2`.
- Implemented a compilation step in the expression parser: expressions are
  compiled into JavaScript, giving much better performance (easily 10x as fast).
- Renamed unit conversion function and operator `in` to `to`. Operator `in` is
  still available in the expression parser as an alias for `to`. Added unit
  `in`, an abbreviation for `inch`. Thanks Elijah Insua (@tmpvar).
- Added plurals and aliases for units.
- Implemented an argument `includeEnd` for function `range` (false by default).
- Ranges in the expression parser now support big numbers.
- Implemented functions `permutations` and `combinations`.
  Thanks Daniel Levin (@daniel-levin).
- Added lower case abbreviation `l` for unit litre.


## 2013-12-19, version 0.17.1

- Fixed a bug with negative temperatures.
- Fixed a bug with prefixes of units squared meter `m2` and cubic meter `m3`.


## 2013-12-12, version 0.17.0

- Renamed and flattened configuration settings:
  - `number.defaultType` is now `number`.
  - `number.precision` is now `decimals`.
  - `matrix.defaultType` is now `matrix`.
- Function `multiply` now consistently outputs a complex number on complex input.
- Fixed `mod` and `in` not working as function (only as operator).
- Fixed support for old browsers (IE8 and older), compatible when using es5-shim.
- Fixed support for Java's ScriptEngine.


## 2013-11-28, version 0.16.0

- Implemented BigNumber support for arbitrary precision calculations.
  Added settings `number.defaultType` and `number.precision` to configure
  big numbers.
- Documentation is extended.
- Removed utility functions `isScalar`, `toScalar`, `isVector`, `toVector`
  from `Matrix` and `Range`. Use `math.squeeze` and `math.size` instead.
- Implemented functions `get` and `set` on `Matrix`, for easier and faster
  retrieval/replacement of elements in a matrix.
- Implemented function `resize`, handling matrices, scalars, and strings.
- Functions `ones` and `zeros` now return an empty matrix instead of a
  number 1 or 0 when no arguments are provided.
- Implemented functions `min` and `max` for `Range` and `Index`.
- Resizing matrices now leaves new elements undefined by default instead of
  filling them with zeros. Function `resize` now has an extra optional
  parameter `defaultValue`.
- Range operator `:` in expression parser has been given a higher precedence.
- Functions don't allow arguments of unknown type anymore.
- Options be set when constructing a math.js instance or using the new function
  `config(options`. Options are no longer accessible via `math.options`.
- Renamed `scientific` notation to `exponential` in function `format`.
- Function `format` outputs exponential notation with positive exponents now
  always with `+` sign, so outputs `2.1e+3` instead of `2.1e3`.
- Fixed function `squeeze` not being able squeeze into a scalar.
- Some fixes and performance improvements in the `resize` and `subset`
  functions.
- Function `size` now adheres to the option `matrix.defaultType` for scalar
  input.
- Minor bug fixes.


## 2013-10-26, version 0.15.0

- Math.js must be instantiated now, static calls are no longer supported. Usage:
  - node.js: `var math = require('mathjs')();`
  - browser: `var math = mathjs();`
- Implemented support for multiplying vectors with matrices.
- Improved number formatting:
  - Function `format` now support various options: precision, different
    notations (`fixed`, `scientific`, `auto`), and more.
  - Numbers are no longer rounded to 5 digits by default when formatted.
  - Implemented a function `format` for `Matrix`, `Complex`, `Unit`, `Range`,
    and `Selector` to format using options.
  - Function `format` does only stringify values now, and has a new parameter
    `precision` to round to a specific number of digits.
  - Removed option `math.options.precision`,
    use `math.format(value [, precision])` instead.
  - Fixed formatting numbers as scientific notation in some cases returning
    a zero digit left from the decimal point. (like "0.33333e8" rather than
    "3.3333e7"). Thanks @husayt.
- Implemented a function `print` to interpolate values in a template string,
  this functionality was moved from the function `format`.
- Implemented statistics function `mean`. Thanks Guillermo Indalecio Fernandez
  (@guillermobox).
- Extended and changed `max` and `min` for multi dimensional matrices: they now
  return the maximum and minimum of the flattened array. An optional second
  argument `dim` allows to calculate the `max` or `min` for specified dimension.
- Renamed option `math.options.matrix.default` to
  `math.options.matrix.defaultType`.
- Removed support for comparing complex numbers in functions `smaller`,
  `smallereq`, `larger`, `largereq`. Complex numbers cannot be ordered.


## 2013-10-08, version 0.14.0

- Introduced an option `math.options.matrix.default` which can have values
  `matrix` (default) or `array`. This option is used by the functions `eye`,
  `ones`, `range`, and `zeros`, to determine the type of matrix output.
- Getting a subset of a matrix will automatically squeeze the resulting subset,
  setting a subset of a matrix will automatically unsqueeze the given subset.
- Removed concatenation of nested arrays in the expression parser.
  You can now input nested arrays like in JavaScript. Matrices can be
  concatenated using the function `concat`.
- The matrix syntax `[...]` in the expression parser now creates 1 dimensional
  matrices by default. `math.eval('[1,2,3,4]')` returns a matrix with
  size `[4]`, `math.eval('[1,2;3,4]')` returns a matrix with size `[2,2]`.
- Documentation is restructured and extended.
- Fixed non working operator `mod` (modulus operator).


## 2013-09-03, version 0.13.0

- Implemented support for booleans in all relevant functions.
- Implemented functions `map` and `forEach`. Thanks Sebastien Piquemal (@sebpic).
- All construction functions can be used to convert the type of variables,
  also element-wise for all elements in an Array or Matrix.
- Changed matrix indexes of the expression parser to one-based with the
  upper-bound included, similar to most math applications. Note that on a
  JavaScript level, math.js uses zero-based indexes with excluded upper-bound.
- Removed support for scalars in the function `subset`, it now only supports
  Array, Matrix, and String.
- Removed the functions `get` and `set` from a selector, they are a duplicate
  of the function `subset`.
- Replaced functions `get` and `set` of `Matrix` with a single function
  `subset`.
- Some moving around with code and namespaces:
  - Renamed namespace `math.expr` to `math.expression` (contains Scope, Parser,
    node objects).
  - Renamed namespace `math.docs` to `math.expression.docs`.
  - Moved `math.expr.Selector` to `math.chaining.Selector`.
- Fixed some edge cases in functions `lcm` and `xgcd`.


## 2013-08-22, version 0.12.1

- Fixed outdated version of README.md.
- Fixed a broken unit test.


## 2013-08-22, version 0.12.0

- Implemented functions `random([min, max])`, `randomInt([min, max])`,
  `pickRandom(array)`. Thanks Sebastien Piquemal (@sebpic).
- Implemented function `distribution(name)`, generating a distribution object
  with functions `random`, `randomInt`, `pickRandom` for different
  distributions. Currently supporting `uniform` and `normal`.
- Changed the behavior of `range` to exclude the upper bound, so `range(1, 4)`
  now returns `[1, 2, 3]` instead of `[1, 2, 3, 4]`.
- Changed the syntax of `range`, which is now `range(start, end [, step])`
  instead of `range(start, [step, ] end)`.
- Changed the behavior of `ones` and `zeros` to geometric dimensions, for
  example `ones(3)` returns a vector with length 3, filled with ones, and
  `ones(3,3)` returns a 2D array with size [3, 3].
- Changed the return type of `ones` and `zeros`: they now return an Array when
  arguments are Numbers or an Array, and returns a Matrix when the argument
  is a Matrix.
- Change matrix index notation in parser from round brackets to square brackets,
  for example `A[0, 0:3]`.
- Removed the feature introduced in v0.10.0 to automatically convert a complex
  value with an imaginary part equal to zero to a number.
- Fixed zeros being formatted as null. Thanks @TimKraft.


## 2013-07-23, version 0.11.1

- Fixed missing development dependency


## 2013-07-23, version 0.11.0

- Changed math.js from one-based to zero-based indexes.
  - Getting and setting matrix subset is now zero-based.
  - The dimension argument in function `concat` is now zero-based.
- Improvements in the string output of function help.
- Added constants `true` and `false`.
- Added constructor function `boolean`.
- Fixed function `select` not accepting `0` as input.
  Thanks Elijah Manor (@elijahmanor).
- Parser now supports multiple unary minus operators after each other.
- Fixed not accepting empty matrices like `[[], []]`.
- Some fixes in the end user documentation.


## 2013-07-08, version 0.10.0

- For complex calculations, all functions now automatically replace results
  having an imaginary part of zero with a Number. (`2i * 2i` now returns a
  Number `-4` instead of a Complex `-4 + 0i`).
- Implemented support for injecting custom node handlers in the parser. Can be
  used for example to implement a node handler for plotting a graph.
- Implemented end user documentation and a new `help` function.
- Functions `size` and `squeeze` now return a Matrix instead of an Array as
  output on Matrix input.
- Added a constant tau (2 * pi). Thanks Zak Zibrat (@palimpsests).
- Renamed function `unaryminus` to `unary`.
- Fixed a bug in determining node dependencies in function assignments.


## 2013-06-14, version 0.9.1

- Implemented element-wise functions and operators: `emultiply` (`x .* y`),
  `edivide` (`x ./ y`), `epow` (`x .^ y`).
- Added constants `Infinity` and `NaN`.
- Removed support for Workspace to keep the library focused on its core task.
- Fixed a bug in the Complex constructor, not accepting NaN values.
- Fixed division by zero in case of pure complex values.
- Fixed a bug in function multiply multiplying a pure complex value with
  Infinity.


## 2013-05-29, version 0.9.0

- Implemented function `math.parse(expr [,scope])`. Optional parameter scope can
  be a plain JavaScript Object containing variables.
- Extended function `math.expr(expr [, scope])` with an additional parameter
  `scope`, similar to `parse`. Example: `math.eval('x^a', {x:3, a:2});`.
- Implemented function `subset`, to get or set a subset from a matrix, string,
  or other data types.
- Implemented construction functions number and string (mainly useful inside
  the parser).
- Improved function `det`. Thanks Bryan Cuccioli (@bcuccioli).
- Moved the parse code from prototype math.expr.Parser to function math.parse,
  simplified Parser a little bit.
- Strongly simplified the code of Scope and Workspace.
- Fixed function mod for negative numerators, and added error messages in case
  of wrong input.


## 2013-05-18, version 0.8.2

- Extended the import function and some other minor improvements.
- Fixed a bug in merging one dimensional vectors into a matrix.
- Fixed a bug in function subtract, when subtracting a complex number from a
  real number.


## 2013-05-10, version 0.8.1

- Fixed an npm warning when installing mathjs globally.


## 2013-05-10, version 0.8.0

- Implemented a command line interface. When math.js is installed globally via
  npm, the application is available on your system as 'mathjs'.
- Implemented `end` keyword for index operator, and added support for implicit
  start and end (expressions like `a(2,:)` and `b(2:end,3:end-1)` are supported
  now).
- Function math.eval is more flexible now: it supports variables and multi-line
  expressions.
- Removed the read-only option from Parser and Scope.
- Fixed non-working unequal operator != in the parser.
- Fixed a bug in resizing matrices when replacing a subset.
- Fixed a bug in updating a subset of a non-existing variable.
- Minor bug fixes.


## 2013-05-04, version 0.7.2

- Fixed method unequal, which was checking for equality instead of inequality.
  Thanks @FJS2.


## 2013-04-27, version 0.7.1

- Improvements in the parser:
  - Added support for chained arguments.
  - Added support for chained variable assignments.
  - Added a function remove(name) to remove a variable from the parsers scope.
  - Renamed nodes for more consistency and to resolve naming conflicts.
  - Improved stringification of an expression tree.
  - Some simplifications in the code.
  - Minor bug fixes.
- Fixed a bug in the parser, returning NaN instead of throwing an error for a
  number with multiple decimal separators like `2.3.4`.
- Fixed a bug in Workspace.insertAfter.
- Fixed: math.js now works on IE 6-8 too.


## 2013-04-20, version 0.7.0

- Implemented method `math.eval`, which uses a readonly parser to evaluate
  expressions.
- Implemented method `xgcd` (extended eucledian algorithm). Thanks Bart Kiers
  (@bkiers).
- Improved math.format, which now rounds values to a maximum number of digits
  instead of decimals (default is 5 digits, for example `math.format(math.pi)`
  returns `3.1416`).
- Added examples.
- Changed methods square and cube to evaluate matrices element wise (consistent
  with all other methods).
- Changed second parameter of method import to an object with options.
- Fixed method math.typeof on IE.
- Minor bug fixes and improvements.


## 2013-04-13, version 0.6.0

- Implemented chained operations via method math.select(). For example
  `math.select(3).add(4).subtract(2).done()` will return `5`.
- Implemented methods gcd and lcm.
- Implemented method `Unit.in(unit)`, which creates a clone of the unit with a
  fixed representation. For example `math.unit('5.08 cm').in('inch')` will
  return a unit which string representation always is in inch, thus `2 inch`.
  `Unit.in(unit)` is the same as method `math.in(x, unit)`.
- Implemented `Unit.toNumber(unit)`, which returns the value of the unit when
  represented with given unit. For example
  `math.unit('5.08 cm').toNumber('inch')` returns the number `2`, as the
  representation of the unit in inches has 2 as value.
- Improved: method `math.in(x, unit)` now supports a string as second parameter,
  for example `math.in(math.unit('5.08 cm'), 'inch')`.
- Split the end user documentation of the parser functions from the source
  files.
- Removed function help and the built-in documentation from the core library.
- Fixed constant i being defined as -1i instead of 1i.
- Minor bug fixes.


## 2013-04-06, version 0.5.0

- Implemented data types Matrix and Range.
- Implemented matrix methods clone, concat, det, diag, eye, inv, ones, size,
  squeeze, transpose, zeros.
- Implemented range operator `:`, and transpose operator `'` in parser.
- Changed: created construction methods for easy object creation for all data
  types and for the parser. For example, a complex value is now created
  with `math.complex(2, 3)` instead of `new math.Complex(2, 3)`, and a parser
  is now created with `math.parser()` instead of `new math.parser.Parser()`.
- Changed: moved all data types under the namespace math.type, and moved the
  Parser, Workspace, etc. under the namespace math.expr.
- Changed: changed operator precedence of the power operator:
  - it is now right associative instead of left associative like most scripting
    languages. So `2^3^4` is now calculated as `2^(3^4)`.
  - it has now higher precedence than unary minus most languages, thus `-3^2` is
    now calculated as `-(3^2)`.
- Changed: renamed the parsers method 'put' into 'set'.
- Fixed: method 'in' did not check for units to have the same base.


## 2013-03-16, version 0.4.0

- Implemented Array support for all methods.
- Implemented Array support in the Parser.
- Implemented method format.
- Implemented parser for units, math.Unit.parse(str).
- Improved parser for complex values math.Complex.parse(str);
- Improved method help: it now evaluates the examples.
- Fixed: a scoping issue with the Parser when defining functions.
- Fixed: method 'typeof' was not working well with minified and mangled code.
- Fixed: errors in determining the best prefix for a unit.


## 2013-03-09, version 0.3.0

- Implemented Workspace
- Implemented methods cot, csc, sec.
- Implemented Array support for methods with one parameter.


## 2013-02-25, version 0.2.0

- Parser, Scope, and expression tree with Nodes implemented.
- Implemented method import which makes it easy to extend math.js.
- Implemented methods arg, conj, cube, equal, factorial, im, largereq,
  log(x, base), log10, mod, re, sign, smallereq, square, unequal.


## 2013-02-18, version 0.1.0

- Reached full compatibility with Javascripts built-in Math library.
- More functions implemented.
- Some bugfixes.


## 2013-02-16, version 0.0.2

- All constants of Math implemented, plus the imaginary unit i.
- Data types Complex and Unit implemented.
- First set of functions implemented.


## 2013-02-15, version 0.0.1

- First publish of the mathjs package. (package is still empty)
