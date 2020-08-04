# Enforce default parameters to be last (`default-param-last`)

## Rule Details

This rule enforces default or optional parameters to be the last of parameters.

Examples of **incorrect** code for this rule:

```ts
/* eslint @typescript-eslint/default-param-last: ["error"] */

function f(a = 0, b: number) {}
function f(a: number, b = 0, c: number) {}
function f(a: number, b?: number, c: number) {}
```

Examples of **correct** code for this rule:

```ts
/* eslint @typescript-eslint/default-param-last: ["error"] */

function f(a = 0) {}
function f(a: number, b = 0) {}
function f(a: number, b?: number) {}
function f(a: number, b?: number, c = 0) {}
function f(a: number, b = 0, c?: number) {}
```

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/default-param-last.md)</sup>
