# History


## 2018-01-24, version 0.10.7

- Fixed the field `data.actual` in a `TypeError` message containing
  the type index instead of the actual type of the argument.


## 2017-11-18, version 0.10.6

- Fixed a security issue allowing to execute aritrary JavaScript code via a 
  specially prepared function name of a typed function. Thanks Masato Kinugawa.


## 2016-11-18, version 0.10.5

- Fixed the use of multi-layered use of `any` type. See #8.


## 2016-04-09, version 0.10.4

- Typed functions can only inherit names from other typed functions and no
  longer from regular JavaScript functions since these names are unreliable:
  they can be manipulated by minifiers and browsers.


## 2015-10-07, version 0.10.3

- Reverted the fix of v0.10.2 until the introduced issue with variable
  arguments is fixed too. Added unit test for the latter case.


## 2015-10-04, version 0.10.2

- Fixed support for using `any` multiple times in a single signture.
  Thanks @luke-gumbley.


## 2015-07-27, version 0.10.1

- Fixed functions `addType` and `addConversion` not being robust against
  replaced arrays `typed.types` and `typed.conversions`.


## 2015-07-26, version 0.10.0

- Dropped support for the following construction signatures in order to simplify
  the API:
  - `typed(signature: string, fn: function)`
  - `typed(name: string, signature: string, fn: function)`
- Implemented convenience methods `typed.addType` and `typed.addConversion`.
- Changed the casing of the type `'function'` to `'Function'`. Breaking change.
- `typed.types` is now an ordered Array containing objects 
  `{name: string, test: function}`. Breaking change.
- List with expected types in error messages no longer includes converted types.


## 2015-05-17, version 0.9.0

- `typed.types` is now an ordered Array containing objects 
  `{type: string, test: function}` instead of an object. Breaking change.
- `typed-function` now allows merging typed functions with duplicate signatures
  when they point to the same function.


## 2015-05-16, version 0.8.3

- Function `typed.find` now throws an error instead of returning `null` when a 
  signature is not found.
- Fixed: the attached signatures no longer contains signatures with conversions.


## 2015-05-09, version 0.8.2

- Fixed function `typed.convert` not handling the case where the value already
  has the requested type. Thanks @rjbaucells.


## 2015-05-09, version 0.8.1

- Implemented option `typed.ignore` to ignore/filter signatures of a typed
  function.


## 2015-05-09, version 0.8.0

- Implemented function `create` to create a new instance of typed-function.
- Implemented a utility function `convert(value, type)` (#1).
- Implemented a simple `typed.find` function to find the implementation of a
  specific function signature.
- Extended the error messages to denote the function name, like `"Too many 
  arguments in function foo (...)"`.


## 2015-04-17, version 0.7.0

- Performance improvements.


## 2015-03-08, version 0.6.3

- Fixed generated internal Signature and Param objects not being cleaned up
  after the typed function has been generated.


## 2015-02-26, version 0.6.2

- Fixed a bug sometimes not ordering the handling of any type arguments last.
- Fixed a bug sometimes not choosing the signature with the lowest number of
  conversions.


## 2015-02-07, version 0.6.1

- Large code refactoring.
- Fixed bugs related to any type parameters.


## 2015-01-16, version 0.6.0

- Removed the configuration option `minify`
  (it's not clear yet whether minifying really improves the performance).
- Internal code simplifications.
- Bug fixes.


## 2015-01-07, version 0.5.0

- Implemented support for merging typed functions.
- Typed functions inherit the name of the function in case of one signature.
- Fixed a bug where a regular argument was not matched when there was a
  signature with variable arguments too.
- Slightly changed the error messages.


## 2014-12-17, version 0.4.0

- Introduced new constructor options, create a typed function as
  `typed([name,] signature, fn)` or `typed([name,] signatures)`.
- Support for multiple types per parameter like `number | string, number'`.
- Support for variable parameters like `sting, ...number'`.
- Changed any type notation `'*'` to `'any'`.
- Implemented detailed error messages.
- Implemented option `typed.config.minify`.


## 2014-11-05, version 0.3.1

- Renamed module to `typed-function`.


## 2014-11-05, version 0.3.0

- Implemented support for any type arguments (denoted with `*`).


## 2014-10-23, version 0.2.0

- Implemented support for named functions.
- Implemented support for type conversions.
- Implemented support for custom types.
- Library packaged as UMD, usable with CommonJS (node.js), AMD, and browser globals.


## 2014-10-21, version 0.1.0

- Implemented support for functions with zero, one, or multiple arguments.


## 2014-10-19, version 0.0.1

- First release (no functionality yet)
