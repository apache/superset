# Require PascalCased class and interface names (`class-name-casing`)

This rule enforces PascalCase names for classes and interfaces.

## Rule Details

This rule aims to make it easy to differentiate classes from regular variables at a glance.
The `_` prefix is sometimes used to designate a private declaration, so the rule also supports a name
that might be `_Example` instead of `Example`.

## Options

This rule has an object option:

- `"allowUnderscorePrefix": false`: (default) does not allow the name to have an underscore prefix
- `"allowUnderscorePrefix": true`: allows the name to optionally have an underscore prefix

## Examples

Examples of **incorrect** code for this rule:

```ts
class invalidClassName {}

class Another_Invalid_Class_Name {}

var bar = class invalidName {};

interface someInterface {}

class _InternalClass {}
```

Examples of **correct** code for this rule:

```ts
class ValidClassName {}

export default class {}

var foo = class {};

interface SomeInterface {}

/* eslint @typescript-eslint/class-name-casing: { "allowUnderscorePrefix": true } */
class _InternalClass {}
```

## When Not To Use It

You should turn off this rule if you do not care about class name casing, or if
you use a different type of casing.

## Further Reading

- [`class-name`](https://palantir.github.io/tslint/rules/class-name/) in [TSLint](https://palantir.github.io/tslint/)
