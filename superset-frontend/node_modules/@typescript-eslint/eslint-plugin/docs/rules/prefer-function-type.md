# Use function types instead of interfaces with call signatures (`prefer-function-type`)

## Rule Details

This rule suggests using a function type instead of an interface or object type literal with a single call signature.

Examples of **incorrect** code for this rule:

```ts
interface Foo {
  (): string;
}
```

```ts
function foo(bar: { (): number }): number {
  return bar();
}
```

```ts
interface Foo extends Function {
  (): void;
}
```

Examples of **correct** code for this rule:

```ts
interface Foo {
  (): void;
  bar: number;
}
```

```ts
function foo(bar: { (): string; baz: number }): string {
  return bar();
}
```

```ts
interface Foo {
  bar: string;
}
interface Bar extends Foo {
  (): void;
}
```

## When Not To Use It

If you specifically want to use an interface or type literal with a single call signature for stylistic reasons, you can disable this rule.

## Further Reading

- TSLint: [`callable-types`](https://palantir.github.io/tslint/rules/callable-types/)
