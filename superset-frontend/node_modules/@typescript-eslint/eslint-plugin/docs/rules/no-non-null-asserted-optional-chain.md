# Disallows using a non-null assertion after an optional chain expression (`no-non-null-asserted-optional-chain`)

## Rule Details

Optional chain expressions are designed to return `undefined` if the optional property is nullish.
Using non-null assertions after an optional chain expression is wrong, and introduces a serious type safety hole into your code.

Examples of **incorrect** code for this rule:

```ts
/* eslint @typescript-eslint/no-non-null-asserted-optional-chain: "error" */

foo?.bar!;
foo?.bar!.baz;
foo?.bar()!;
foo?.bar!();
foo?.bar!().baz;
```

Examples of **correct** code for this rule:

```ts
/* eslint @typescript-eslint/no-non-null-asserted-optional-chain: "error" */

foo?.bar;
(foo?.bar).baz;
foo?.bar();
foo?.bar();
foo?.bar().baz;
```

## When Not To Use It

If you are not using TypeScript 3.7 (or greater), then you will not need to use this rule, as the operator is not supported.

## Further Reading

- [TypeScript 3.7 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html)
- [Optional Chaining Proposal](https://github.com/tc39/proposal-optional-chaining/)
