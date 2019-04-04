# Enforce valid `expect()` usage (valid-expect)

Ensure `expect()` is called with a single argument and there is an actual
expectation made.

## Rule details

This rule triggers a warning if `expect()` is called with more than one argument
or without arguments. It would also issue a warning if there is nothing called
on `expect()`, e.g.:

```js
expect();
expect('something');
```

or when a matcher function was not called, e.g.:

```js
expect(true).toBeDefined;
```

This rule is enabled by default.

### Default configuration

The following patterns are considered warnings:

```js
expect();
expect().toEqual('something');
expect('something', 'else');
expect('something');
expect(true).toBeDefined;
expect(Promise.resolve('hello')).resolves;
```

The following patterns are not warnings:

```js
expect('something').toEqual('something');
expect([1, 2, 3]).toEqual([1, 2, 3]);
expect(true).toBeDefined();
expect(Promise.resolve('hello')).resolves.toEqual('hello');
```
