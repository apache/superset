# Suggest using inline snapshots (prefer-inline-snapshots)

In order to make snapshot tests more managable and reviewable
`toMatchInlineSnapshot()` and `toThrowErrorMatchingInlineSnapshot` should be
used to write the snapshots inline in the test file.

## Rule details

This rule triggers a warning if `toMatchSnapshot()` or
`toThrowErrorMatchingSnapshot` is used to capture a snapshot.

The following pattern is considered warning:

```js
expect(obj).toMatchSnapshot();
```

```js
expect(error).toThrowErrorMatchingSnapshot();
```

The following pattern is not warning:

```js
expect(obj).toMatchInlineSnapshot();
```

```js
expect(error).toThrowErrorMatchingInlineSnapshot();
```
