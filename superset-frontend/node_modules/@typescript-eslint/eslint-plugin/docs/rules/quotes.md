# Enforce the consistent use of either backticks, double, or single quotes (`quotes`)

## Rule Details

This rule extends the base [`eslint/quotes`](https://eslint.org/docs/rules/quotes) rule.
It supports all options and features of the base rule.

## How to use

```cjson
{
  // note you must disable the base rule as it can report incorrect errors
  "quotes": "off",
  "@typescript-eslint/quotes": ["error"]
}
```

## Options

See [`eslint/quotes` options](https://eslint.org/docs/rules/quotes#options).

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/quotes.md)</sup>
