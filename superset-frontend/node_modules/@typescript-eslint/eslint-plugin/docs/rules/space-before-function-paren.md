# Enforces consistent spacing before function parenthesis (`space-before-function-paren`)

When formatting a function, whitespace is allowed between the function name or `function` keyword and the opening parenthesis. Named functions also require a space between the `function` keyword and the function name, but anonymous functions require no whitespace. For example:

<!-- prettier-ignore -->
```ts
function withoutSpace(x) {
  // ...
}

function withSpace (x) {
  // ...
}

var anonymousWithoutSpace = function() {};

var anonymousWithSpace = function () {};
```

Style guides may require a space after the `function` keyword for anonymous functions, while others specify no whitespace. Similarly, the space after a function name may or may not be required.

## Rule Details

This rule extends the base [`eslint/space-before-function-paren`](https://eslint.org/docs/rules/space-before-function-paren) rule.
It supports all options and features of the base rule.
This version adds support for generic type parameters on function calls.

## How to use

```cjson
{
  // note you must disable the base rule as it can report incorrect errors
  "space-before-function-paren": "off",
  "@typescript-eslint/space-before-function-paren": ["error"]
}
```

## Options

See [`eslint/space-before-function-paren` options](https://eslint.org/docs/rules/space-before-function-paren#options).

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/space-before-function-paren.md)</sup>
