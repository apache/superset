# Disallow unnecessary semicolons (`no-extra-semi`)

## Rule Details

This rule extends the base [`eslint/no-extra-semi`](https://eslint.org/docs/rules/no-extra-semi) rule.

## How to use

```cjson
{
  // note you must disable the base rule as it can report incorrect errors
  "no-extra-semi": "off",
  "@typescript-eslint/no-extra-semi": ["error"]
}
```

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/no-extra-semi.md)</sup>
