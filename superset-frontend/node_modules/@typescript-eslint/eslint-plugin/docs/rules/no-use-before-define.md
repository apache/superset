# Disallow the use of variables before they are defined (`no-use-before-define`)

In JavaScript, prior to ES6, variable and function declarations are hoisted to the top of a scope, so it's possible to use identifiers before their formal declarations in code. This can be confusing and some believe it is best to always declare variables and functions before using them.

In ES6, block-level bindings (`let` and `const`) introduce a "temporal dead zone" where a `ReferenceError` will be thrown with any attempt to access the variable before its declaration.

## Rule Details

This rule will warn when it encounters a reference to an identifier that has not yet been declared.

Examples of **incorrect** code for this rule:

```ts
/*eslint no-use-before-define: "error"*/
/*eslint-env es6*/

alert(a);
var a = 10;

f();
function f() {}

function g() {
  return b;
}
var b = 1;

// With blockBindings: true
{
  alert(c);
  let c = 1;
}

let myVar: StringOrNumber;
type StringOrNumber = string | number;
```

Examples of **correct** code for this rule:

```ts
/*eslint no-use-before-define: "error"*/
/*eslint-env es6*/

var a;
a = 10;
alert(a);

function f() {}
f(1);

var b = 1;
function g() {
  return b;
}

// With blockBindings: true
{
  let C;
  c++;
}

type StringOrNumber = string | number;
let myVar: StringOrNumber;
```

## Options

```json
{
  "no-use-before-define": ["error", { "functions": true, "classes": true }]
}
```

- `functions` (`boolean`) -
  The flag which shows whether or not this rule checks function declarations.
  If this is `true`, this rule warns every reference to a function before the function declaration.
  Otherwise, ignores those references.
  Function declarations are hoisted, so it's safe.
  Default is `true`.
- `classes` (`boolean`) -
  The flag which shows whether or not this rule checks class declarations of upper scopes.
  If this is `true`, this rule warns every reference to a class before the class declaration.
  Otherwise, ignores those references if the declaration is in upper function scopes.
  Class declarations are not hoisted, so it might be danger.
  Default is `true`.
- `enums` (`boolean`) -
  The flag which shows whether or not this rule checks enum declarations of upper scopes.
  If this is `true`, this rule warns every reference to a enum before the enum declaration.
  Otherwise, ignores those references.
  Default is `true`.
- `variables` (`boolean`) -
  This flag determines whether or not the rule checks variable declarations in upper scopes.
  If this is `true`, the rule warns every reference to a variable before the variable declaration.
  Otherwise, the rule ignores a reference if the declaration is in an upper scope, while still reporting the reference if it's in the same scope as the declaration.
  Default is `true`.
- `typedefs` (`boolean`, **added** in `@typescript-eslint/eslint-plugin`) -
  The flag which shows whether or not this rule checks type declarations.
  If this is `true`, this rule warns every reference to a type before the type declaration.
  Otherwise, ignores those references.
  Type declarations are hoisted, so it's safe.
  Default is `true`.

This rule accepts `"nofunc"` string as an option.
`"nofunc"` is the same as `{ "functions": false, "classes": true }`.

### `functions`

Examples of **correct** code for the `{ "functions": false }` option:

```js
/*eslint no-use-before-define: ["error", { "functions": false }]*/

f();
function f() {}
```

### `classes`

Examples of **incorrect** code for the `{ "classes": false }` option:

```js
/*eslint no-use-before-define: ["error", { "classes": false }]*/
/*eslint-env es6*/

new A();
class A {}
```

Examples of **correct** code for the `{ "classes": false }` option:

```js
/*eslint no-use-before-define: ["error", { "classes": false }]*/
/*eslint-env es6*/

function foo() {
  return new A();
}

class A {}
```

### `enums`

Examples of **incorrect** code for the `{ "enums": true }` option:

```ts
/*eslint no-use-before-define: ["error", { "enums": true }]*/

function foo() {
  return Foo.FOO;
}

class Test {
  foo() {
    return Foo.FOO;
  }
}

enum Foo {
  FOO,
  BAR,
}
```

Examples of **correct** code for the `{ "enums": false }` option:

```ts
/*eslint no-use-before-define: ["error", { "enums": false }]*/

function foo() {
  return Foo.FOO;
}

enum Foo {
  FOO,
}
```

### `variables`

Examples of **incorrect** code for the `{ "variables": false }` option:

```js
/*eslint no-use-before-define: ["error", { "variables": false }]*/

console.log(foo);
var foo = 1;
```

Examples of **correct** code for the `{ "variables": false }` option:

```js
/*eslint no-use-before-define: ["error", { "variables": false }]*/

function baz() {
  console.log(foo);
}

var foo = 1;
```

### `typedefs`

Examples of **correct** code for the `{ "typedefs": false }` option:

```ts
/*eslint no-use-before-define: ["error", { "typedefs": false }]*/

let myVar: StringOrNumber;
type StringOrNumber = string | number;
```

Copied from [the original ESLint rule docs](https://github.com/eslint/eslint/blob/a113cd3/docs/rules/no-use-before-define.md)
