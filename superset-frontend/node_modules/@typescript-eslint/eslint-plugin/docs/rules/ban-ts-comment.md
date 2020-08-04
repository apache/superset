# Bans `// @ts-<directive>` comments from being used (`ban-ts-comment`)

TypeScript provides several directive comments that can be used to alter how it processes files.
Using these to suppress TypeScript Compiler Errors reduces the effectiveness of TypeScript overall.

The directive comments supported by TypeScript are:

```
// @ts-ignore
// @ts-nocheck
// @ts-check
```

## Rule Details

This rule lets you set which directive comments you want to allow in your codebase.
By default, only `@ts-check` is allowed, as it enables rather then suppresses errors.

The configuration looks like this:

```
interface Options {
  'ts-ignore'?: boolean;
  'ts-nocheck'?: boolean;
  'ts-check'?: boolean;
}

const defaultOptions: Options = {
  'ts-ignore': true,
  'ts-nocheck': true,
  'ts-check': false
}
```

A value of `true` for a particular directive means that this rule will report if it finds any usage of said directive.

For example, with the defaults above the following patterns are considered warnings:

```ts
if (false) {
  // @ts-ignore: Unreachable code error
  console.log('hello');
}
```

The following patterns are not warnings:

```ts
if (false) {
  // Compiler warns about unreachable code error
  console.log('hello');
}
```

## When Not To Use It

If you want to use all of the TypeScript directives.

## Further Reading

- TypeScript [Type Checking JavaScript Files](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)

## Compatibility

- TSLint: [ban-ts-ignore](https://palantir.github.io/tslint/rules/ban-ts-ignore/)
