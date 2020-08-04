# Suggest using `toBeNull()` (prefer-to-be-null)

In order to have a better failure message, `toBeNull()` should be used upon
asserting expections on null value.

## Rule details

This rule triggers a warning if `toBe()` is used to assert a null value.

```js
expect(null).toBe(null);
```

This rule is enabled by default.

### Default configuration

The following pattern is considered warning:

```js
expect(null).toBe(null);
```

The following pattern is not warning:

```js
expect(null).toBeNull();
```
