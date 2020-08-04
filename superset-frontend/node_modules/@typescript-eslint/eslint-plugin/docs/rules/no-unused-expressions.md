# Disallow unused expressions (`no-unused-expressions`)

This rule aims to eliminate unused expressions which have no effect on the state of the program.

## Rule Details

This rule extends the base [`eslint/no-unused-expressions`](https://eslint.org/docs/rules/no-unused-expressions) rule.
It supports all options and features of the base rule.
This version adds support for numerous typescript features.

## How to use

```cjson
{
  // note you must disable the base rule as it can report incorrect errors
  "no-unused-expressions": "off",
  "@typescript-eslint/no-unused-expressions": ["error"]
}
```

## Options

See [`eslint/no-unused-expressions` options](https://eslint.org/docs/rules/no-unused-expressions#options).

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/no-unused-expressions.md)</sup>
