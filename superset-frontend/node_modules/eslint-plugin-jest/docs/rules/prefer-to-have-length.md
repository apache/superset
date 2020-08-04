# Suggest using `toHaveLength()` (prefer-to-have-length)

In order to have a better failure message, `toHaveLength()` should be used upon
asserting expectations on object's length property.

## Rule details

This rule triggers a warning if `toBe()` is used to assert object's length
property.

```js
expect(files.length).toBe(1);
```

This rule is enabled by default.

### Default configuration

The following pattern is considered warning:

```js
expect(files.length).toBe(1);
```

The following pattern is not warning:

```js
expect(files).toHaveLength(1);
```
