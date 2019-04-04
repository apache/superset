# Suggest using `toBeUndefined()` (prefer-to-be-undefined)

In order to have a better failure message, `toBeUndefined()` should be used upon
asserting expections on undefined value.

## Rule details

This rule triggers a warning if `toBe()` is used to assert a undefined value.

```js
expect(undefined).toBe(undefined);
```

This rule is enabled by default.

### Default configuration

The following pattern is considered warning:

```js
expect(undefined).toBe(undefined);
```

The following pattern is not warning:

```js
expect(undefined).toBeUndefined();
```
