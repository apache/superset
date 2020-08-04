# Enforces naming conventions for class members by visibility (`member-naming`)

It can be helpful to enforce naming conventions for `private` (and sometimes `protected`) members of an object. For example, prefixing private properties with a `_` allows them to be easily discerned when being inspected by tools that do not have knowledge of TypeScript (such as most debuggers).

## Rule Details

This rule allows you to enforce conventions for class property and method names by their visibility. By default, it enforces nothing.

> Note: constructors are explicitly ignored regardless of the the regular expression options provided

## Options

You can specify a regular expression to test the names of properties for each visibility level: `public`, `protected`, `private`.

Examples of **correct** code with `{ "private": "^_" }` specified:

```ts
class HappyClass {
  private _foo: string;
  private _bar = 123;
  private _fizz() {}
}
```

Examples of **incorrect** code with `{ "private": "^_" }` specified:

```ts
class SadClass {
  private foo: string;
  private bar = 123;
  private fizz() {}
}
```

## When Not To Use It

If you do not want to enforce per-visibility naming rules for member properties.

## Further Reading

- ESLint's [`camelcase` rule](https://eslint.org/docs/rules/camelcase)
