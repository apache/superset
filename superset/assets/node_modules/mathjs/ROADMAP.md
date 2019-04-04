# Roadmap

A rough roadmap for math.js.


## Version 1.x

- Support for derived units (like `km/h`, `kg*m/s2`, etc).
- Improve performance. Rewrite `Matrix` to support typed arrays.
- Change to a modular architecture, split the library into separate modules 
  like `mathjs-core`, `mathjs-expression`, `mathjs-unit`, `mathjs-matrix`,
  `mathjs-complex`, `mathjs-bignumber`, and maybe separate modules 
  `mathjs-statistics`, `mathjs-numeric`, etc.
- Support for fractions.
- Functions and data types for numeral systems: Bin, Oct, Hex, Dec.
- BigNumber support for all functions and constants (for example trigonometric 
  functions still miss BigNumber support).
- Full scripting capabilities for the expression parser (for and while loops, 
  function blocks, etc).
- Implement a more broad set of common functions covering all common 
  mathematical areas.


## Version 2.x

- Support for symbolic algebra.
