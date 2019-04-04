# Require a message for `toThrow()` (require-tothrow-message)

`toThrow()`, and its alias `toThrowError()`, are used to check if an error is
thrown by a function call, such as in `expect(() => a()).toThrow()`. However, if
no message is defined, then the test will pass for any thrown error. Requiring a
message ensures that the intended error is thrown.

## Rule details

This rule triggers a warning if `toThrow()` or `toThrowError()` is used without
an error message.

### Default configuration

The following patterns are considered warnings:

```js
expect(() => a()).toThrow();

expect(() => a()).toThrowError();
```

The following patterns are not considered warnings:

```js
expect(() => a()).toThrow('a');

expect(() => a()).toThrowError('a');
```
