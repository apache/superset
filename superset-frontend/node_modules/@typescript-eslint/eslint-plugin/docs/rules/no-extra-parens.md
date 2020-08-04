# Disallow unnecessary parentheses (`no-extra-parens`)

This rule restricts the use of parentheses to only where they are necessary.

## Rule Details

This rule extends the base [`eslint/no-extra-parens`](https://eslint.org/docs/rules/no-extra-parens) rule.
It supports all options and features of the base rule plus TS type assertions.

## How to use

```cjson
{
    // note you must disable the base rule as it can report incorrect errors
    "no-extra-parens": "off",
    "@typescript-eslint/no-extra-parens": ["error"]
}
```

## Options

See [`eslint/no-extra-parens` options](https://eslint.org/docs/rules/no-extra-parens#options).
