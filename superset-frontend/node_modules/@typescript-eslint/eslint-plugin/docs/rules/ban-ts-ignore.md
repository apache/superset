# Bans “// @ts-ignore” comments from being used (`ban-ts-ignore`)

This rule has been deprecated in favor of [`ban-ts-comment`](./ban-ts-comment.md)

Suppressing TypeScript Compiler Errors can be hard to discover.

## Rule Details

Does not allow the use of `// @ts-ignore` comments.

The following patterns are considered warnings:

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

If you are sure, compiler errors won't affect functionality and you need to disable them.

## Further Reading

- TypeScript [Type Checking JavaScript Files](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)

## Compatibility

- TSLint: [ban-ts-ignore](https://palantir.github.io/tslint/rules/ban-ts-ignore/)
