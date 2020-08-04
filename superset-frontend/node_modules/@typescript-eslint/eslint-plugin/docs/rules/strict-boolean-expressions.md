# Restricts the types allowed in boolean expressions (`strict-boolean-expressions`)

Requires that any boolean expression is limited to true booleans rather than
casting another primitive to a boolean at runtime.

It is useful to be explicit, for example, if you were trying to check if a
number was defined. Doing `if (number)` would evaluate to `false` if `number`
was defined and `0`. This rule forces these expressions to be explicit and to
strictly use booleans.

The following nodes are checked:

- Arguments to the `!`, `&&`, and `||` operators
- The condition in a conditional expression `(cond ? x : y)`
- Conditions for `if`, `for`, `while`, and `do-while` statements.

Examples of **incorrect** code for this rule:

```ts
const number = 0;
if (number) {
  return;
}

let foo = bar || 'foobar';

let undefinedItem;
let foo = undefinedItem ? 'foo' : 'bar';

let str = 'foo';
while (str) {
  break;
}
```

Examples of **correct** code for this rule:

```ts
const number = 0;
if (typeof number !== 'undefined') {
  return;
}

let foo = typeof bar !== 'undefined' ? bar : 'foobar';

let undefinedItem;
let foo = typeof undefinedItem !== 'undefined' ? 'foo' : 'bar';

let str = 'foo';
while (typeof str !== 'undefined') {
  break;
}
```

## Options

Options may be provided as an object with:

- `allowNullable` to allow `undefined` and `null` in addition to `boolean` as a type of all boolean expressions. (`false` by default).
- `allowSafe` to allow non-falsy types (i.e. non string / number / boolean) in addition to `boolean` as a type of all boolean expressions. (`false` by default).
- `ignoreRhs` to skip the check on the right hand side of expressions like `a && b` or `a || b` - allows these operators to be used for their short-circuiting behavior. (`false` by default).

## Related To

- TSLint: [strict-boolean-expressions](https://palantir.github.io/tslint/rules/strict-boolean-expressions)

- [no-unnecessary-condition](./no-unnecessary-condition.md) - essentially a less opinionated alternative to this rule. `strict-boolean-expressions` enforces a specific code style, while `no-unnecessary-condition` is about correctness.
