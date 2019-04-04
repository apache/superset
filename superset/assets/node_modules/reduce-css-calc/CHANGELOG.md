# 1.3.0 - 2016-08-26

- Added: calc identifier from unresolved nested expressions are removed for
  better browser support
  ([#19](https://github.com/MoOx/reduce-css-calc/pull/19) - @ben-eb)

# 1.2.8 - 2016-08-26

- Fixed: regression from 1.2.5 on calc() with value without leading 0
  ([#17](https://github.com/MoOx/reduce-css-calc/pull/17) - @ben-eb)

# 1.2.7 - 2016-08-22

- Fixed: regression from 1.2.5 on calc() with value without leading 0
  (@MoOx)

# 1.2.6 - 2016-08-22

- Fixed: regression from 1.2.5 on calc() on multiple lines
  (@MoOx)

# 1.2.5 - 2016-08-22

- Fixed: security issue due to the usage of ``eval()``.
  This is to avoid an arbitrary code execution.
  Now operations are resolved using
  [``math-expression-evaluator``](https://github.com/redhivesoftware/math-expression-evaluator)

# 1.2.4 - 2016-06-09

- Fixed: zero values are not unitless anymore.
  Browsers do not calculate calc() with 0 unitless values.
  http://jsbin.com/punivivipo/edit?html,css,output
  ([#11](https://github.com/MoOx/reduce-css-calc/pull/11)) 

# 1.2.3 - 2016-04-28

- Fixed: wrong rouding in some edge cases
  ([#10](https://github.com/MoOx/reduce-css-calc/pull/10))

# 1.2.2 - 2016-04-19

- Fixed: Don't reduce expression containing CSS variables.
  ([#9](https://github.com/MoOx/reduce-css-calc/pull/9))

# 1.2.1 - 2016-02-22

- Fixed: uppercase letters in units are now supported
  ([#8](https://github.com/MoOx/reduce-css-calc/pull/8))

# 1.2.0 - 2014-11-24

- Decimal precision is now customisable as the `precision` option

# 1.1.4 - 2014-11-12

- 5 decimals rounding for everything

# 1.1.3 - 2014-08-13

- 5 decimals rounding for percentage

# 1.1.2 - 2014-08-10

- Prevent infinite loop by adding a `Call stack overflow`
- Correctly ignore unrecognized values (safer evaluation for nested expressions,
  see [postcss/postcss-calc#2](https://github.com/postcss/postcss-calc/issues/2))
- Handle rounding issues (eg: 10% * 20% now give 2%, not 2.0000000000000004%)

# 1.1.1 - 2014-08-06

- Fix issue when using mutiples differents prefixes in the same function

# 1.1.0 - 2014-08-06

- support more complex formulas
- use `reduce-function-call`
- better error message


# 1.0.0 - 2014-08-04

First release

- based on [rework-calc](https://github.com/reworkcss/rework-calc) v1.1.0
- add error if the calc() embed an empty calc() or empty ()
- jscs + jshint added before tests
