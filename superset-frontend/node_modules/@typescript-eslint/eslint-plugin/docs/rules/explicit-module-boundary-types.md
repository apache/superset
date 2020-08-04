# Require explicit return and argument types on exported functions' and classes' public class methods (`explicit-module-boundary-types`)

Explicit types for function return values and arguments makes it clear to any calling code what is the module boundary's input and output.

Consider using this rule in place of [`no-untyped-public-signature`](./no-untyped-public-signature.md) which has been deprecated.

## Rule Details

This rule aims to ensure that the values returned from a module are of the expected type.

The following patterns are considered warnings:

```ts
// Should indicate that no value is returned (void)
export function test() {
  return;
}

// Should indicate that a number is returned
export default function() {
  return 1;
}

// Should indicate that a string is returned
export var arrowFn = () => 'test';

// All arguments should be typed
export var arrowFn = (arg): string => `test ${arg}`;

export class Test {
  // Should indicate that no value is returned (void)
  method() {
    return;
  }
}
```

The following patterns are not warnings:

```ts
// Function is not exported
function test() {
  return;
}

// A return value of type number
export var fn = function(): number {
  return 1;
};

// A return value of type string
export var arrowFn = (arg: string): string => `test ${arg}`;

// Class is not exported
class Test {
  method() {
    return;
  }
}
```

## Options

The rule accepts an options object with the following properties:

```ts
type Options = {
  /**
   * If true, type annotations are also allowed on the variable of a function expression
   * rather than on the function arguments/return value directly.
   */
  allowTypedFunctionExpressions?: boolean;
  /**
   * If true, functions immediately returning another function expression will not
   * require an explicit return value annotation.
   * You must still type the parameters of the function.
   */
  allowHigherOrderFunctions?: boolean;
  /**
   * If true, body-less arrow functions that return an `as const` type assertion will not
   * require an explicit return value annotation.
   * You must still type the parameters of the function.
   */
  allowDirectConstAssertionInArrowFunctions?: boolean;
  /**
   * An array of function/method names that will not have their arguments or their return values checked.
   */
  allowedNames?: string[];
};

const defaults = {
  allowTypedFunctionExpressions: true,
  allowHigherOrderFunctions: true,
  allowedNames: [],
};
```

### Configuring in a mixed JS/TS codebase

If you are working on a codebase within which you lint non-TypeScript code (i.e. `.js`/`.jsx`), you should ensure that you should use [ESLint `overrides`](https://eslint.org/docs/user-guide/configuring#disabling-rules-only-for-a-group-of-files) to only enable the rule on `.ts`/`.tsx` files. If you don't, then you will get unfixable lint errors reported within `.js`/`.jsx` files.

```jsonc
{
  "rules": {
    // disable the rule for all files
    "@typescript-eslint/explicit-module-boundary-types": "off"
  },
  "overrides": [
    {
      // enable the rule specifically for TypeScript files
      "files": ["*.ts", "*.tsx"],
      "rules": {
        "@typescript-eslint/explicit-module-boundary-types": ["error"]
      }
    }
  ]
}
```

### `allowTypedFunctionExpressions`

Examples of **incorrect** code for this rule with `{ allowTypedFunctionExpressions: true }`:

```ts
export let arrowFn = () => 'test';

export let funcExpr = function() {
  return 'test';
};

export let objectProp = {
  foo: () => 1,
};

export const foo = bar => {};
```

Examples of additional **correct** code for this rule with `{ allowTypedFunctionExpressions: true }`:

```ts
type FuncType = () => string;

export let arrowFn: FuncType = () => 'test';

export let funcExpr: FuncType = function() {
  return 'test';
};

export let asTyped = (() => '') as () => string;
export let castTyped = <() => string>(() => '');

interface ObjectType {
  foo(): number;
}
export let objectProp: ObjectType = {
  foo: () => 1,
};
export let objectPropAs = {
  foo: () => 1,
} as ObjectType;
export let objectPropCast = <ObjectType>{
  foo: () => 1,
};

type FooType = (bar: string) => void;
export const foo: FooType = bar => {};
```

### `allowHigherOrderFunctions`

Examples of **incorrect** code for this rule with `{ allowHigherOrderFunctions: true }`:

```ts
export var arrowFn = () => () => {};

export function fn() {
  return function() {};
}

export function foo(outer) {
  return function(inner): void {};
}
```

Examples of **correct** code for this rule with `{ allowHigherOrderFunctions: true }`:

```ts
export var arrowFn = () => (): void => {};

export function fn() {
  return function(): void {};
}

export function foo(outer: string) {
  return function(inner: string): void {};
}
```

### `allowDirectConstAssertionInArrowFunctions`

Examples of **incorrect** code for this rule with `{ allowDirectConstAssertionInArrowFunctions: true }`:

```ts
export const func = (value: number) => ({ type: 'X', value });
export const foo = () => {
  return {
    bar: true,
  } as const;
};
export const bar = () => 1;
export const baz = arg => arg as const;
```

Examples of **correct** code for this rule with `{ allowDirectConstAssertionInArrowFunctions: true }`:

```ts
export const func = (value: number) => ({ type: 'X', value } as const);
export const foo = () =>
  ({
    bar: true,
  } as const);
export const bar = () => 1 as const;
export const baz = (arg: string) => arg as const;
```

### `allowedNames`

You may pass function/method names you would like this rule to ignore, like so:

```json
{
  "@typescript-eslint/explicit-module-boundary-types": [
    "error",
    {
      "allowedName": ["ignoredFunctionName", "ignoredMethodName"]
    }
  ]
}
```

## When Not To Use It

If you wish to make sure all functions have explicit return types, as opposed to only the module boundaries, you can use [explicit-function-return-type](https://github.com/eslint/eslint/blob/master/docs/rules/explicit-function-return-type.md)

## Further Reading

- TypeScript [Functions](https://www.typescriptlang.org/docs/handbook/functions.html#function-types)
