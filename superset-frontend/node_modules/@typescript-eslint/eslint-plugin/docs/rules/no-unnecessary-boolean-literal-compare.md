# Flags unnecessary equality comparisons against boolean literals (`no-unnecessary-boolean-literal-compare`)

Comparing boolean values to boolean literals is unnecessary, those comparisons result in the same booleans. Using the boolean values directly, or via a unary negation (`!value`), is more concise and clearer.

## Rule Details

This rule ensures that you do not include unnecessary comparisons with boolean literals.
A comparison is considered unnecessary if it checks a boolean literal against any variable with just the `boolean` type.
A comparison is **_not_** considered unnecessary if the type is a union of booleans (`string | boolean`, `someObject | boolean`).

Examples of **incorrect** code for this rule:

```ts
declare const someCondition: boolean;
if (someCondition === true) {
}
```

Examples of **correct** code for this rule

```ts
declare const someCondition: boolean;
if (someCondition) {
}

declare const someObjectBoolean: boolean | Record<string, unknown>;
if (someObjectBoolean === true) {
}

declare const someStringBoolean: boolean | string;
if (someStringBoolean === true) {
}

declare const someUndefinedCondition: boolean | undefined;
if (someUndefinedCondition === false) {
}
```

## Related to

- TSLint: [no-boolean-literal-compare](https://palantir.github.io/tslint/rules/no-boolean-literal-compare)
