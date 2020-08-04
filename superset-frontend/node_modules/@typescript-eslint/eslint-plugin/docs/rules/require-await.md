# Disallow async functions which have no `await` expression (`require-await`)

Asynchronous functions that don’t use `await` might not need to be asynchronous functions and could be the unintentional result of refactoring.

## Rule Details

The `@typescript-eslint/require-await` rule extends the `require-await` rule from ESLint core, and allows for cases where the additional typing information can prevent false positives that would otherwise trigger the rule.

One example is when a function marked as `async` returns a value that is:

1. already a promise; or
2. the result of calling another `async` function

```typescript
async function numberOne(): Promise<number> {
  return Promise.resolve(1);
}

async function getDataFromApi(endpoint: string): Promise<Response> {
  return fetch(endpoint);
}
```

In the above examples, the core `require-await` triggers the following warnings:

```
async function 'numberOne' has no 'await' expression
async function 'getDataFromApi' has no 'await' expression
```

One way to resolve these errors is to remove the `async` keyword. However doing so can cause a conflict with the [`@typescript-eslint/promise-function-async`](https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/promise-function-async.md) rule (if enabled), which requires any function returning a promise to be marked as `async`.

Another way to resolve these errors is to add an `await` keyword to the return statements. However doing so can cause a conflict with the [`no-return-await`](https://eslint.org/docs/rules/no-return-await) rule (if enabled), which warns against using `return await` since the return value of an `async` function is always wrapped in `Promise.resolve` anyway.

With the additional typing information available in TypeScript code, this extension to the `require-await` rule is able to look at the _actual_ return types of an `async` function (before being implicitly wrapped in `Promise.resolve`), and avoid the need for an `await` expression when the return value is already a promise.

See the [ESLint documentation](https://eslint.org/docs/rules/require-await) for more details on the `require-await` rule.

## Rule Changes

```cjson
{
    // note you must disable the base rule as it can report incorrect errors
    "require-await": "off",
    "@typescript-eslint/require-await": "error"
}
```

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/require-await.md)</sup>
