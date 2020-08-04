# HTML output

The expression parser can output a HTML string, where every `Node` is
transformed into a `<span>` element with semantic class names. Each class
name begins with the `math-` prefix. These class names can be used in CSS to
highlight the syntax or change the default layout (e.g. spaces around operators).

## Available class names

- `math-number`
- `math-string`
- `math-boolean` (`true` and `false`)
- `math-undefined`
- `math-function` (function names)
- `math-parameter` (function parameters)
- `math-property` (object members)
- `math-symbol` (variables, units and built-in constants)
  - `math-null-symbol` (`null`)
  - `math-nan-symbol` (`NaN`)
  - `math-infinity-symbol` (`Infinity`)
  - `math-uninitialized-symbol` (`uninitialized`)
  - `math-imaginary-symbol` (`i`)
- `math-operator`
  - `math-unary-operator`
    - `math-lefthand-unary-operator`
    - `math-righthand-unary-operator`
  - `math-binary-operator`
    - `math-explicit-binary-operator`
    - `math-implicit-binary-operator` (empty element)
  - `math-assignment-operator`
    - `math-variable-assignment-operator` (`=`)
    - `math-property-assignment-operator` (`:` in objects)
  - `math-accessor-operator` (`.` in objects)
  - `math-range-operator` (`:` in ranges)
- `math-parenthesis`
  -`math-round-parenthesis` (`(` and `)`)
  -`math-square-parenthesis` (`[` and `]`)
  -`math-curly-parenthesis` (`{` and `}`)
- `math-separator` (ÿ,`, `;` and `<br />`)