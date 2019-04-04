# Suggest using `toContain()` (prefer-to-contain)

In order to have a better failure message, `toContain()` should be used upon
asserting expectations on an array containing an object.

## Rule details

This rule triggers a warning if `toBe()` or `isEqual()` is used to assert object
inclusion in an array

```js
expect(a.includes(b)).toBe(true);
```

```js
expect(a.includes(b)).not.toBe(true);
```

```js
expect(a.includes(b)).toBe(false);
```

### Default configuration

The following patterns are considered a warning:

```js
expect(a.includes(b)).toBe(true);
```

```js
expect(a.includes(b)).not.toBe(true);
```

```js
expect(a.includes(b)).toBe(false);
```

The following patterns are not a warning:

```js
expect(a).toContain(b);
```

```js
expect(a).not.toContain(b);
```
