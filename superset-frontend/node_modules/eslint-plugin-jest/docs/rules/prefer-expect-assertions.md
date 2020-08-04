# Suggest using `expect.assertions()` OR `expect.hasAssertions()` (prefer-expect-assertions)

Ensure every test to have either `expect.assertions(<number of assertions>)` OR
`expect.hasAssertions()` as its first expression.

## Rule details

This rule triggers a warning if,

- `expect.assertions(<number of assertions>)` OR `expect.hasAssertions()` is not
  present as first statement in a test, e.g.:

```js
test('my test', () => {
  expect(someThing()).toEqual('foo');
});
```

- `expect.assertions(<number of assertions>)` is the first statement in a test
  where argument passed to `expect.assertions(<number of assertions>)` is not a
  valid number, e.g.:

```js
test('my test', () => {
  expect.assertions('1');
  expect(someThing()).toEqual('foo');
});
```

### Default configuration

The following patterns are considered warnings:

```js
test("my test", () => {
  expect.assertions("1");
  expect(someThing()).toEqual("foo");
});

test("my test", () => {
  expect.(someThing()).toEqual("foo");
});
```

The following patterns would not be considered warnings:

```js
test('my test', () => {
  expect.assertions(1);
  expect(someThing()).toEqual('foo');
});

test('my test', () => {
  expect.hasAssertions();
  expect(someThing()).toEqual('foo');
});
```
