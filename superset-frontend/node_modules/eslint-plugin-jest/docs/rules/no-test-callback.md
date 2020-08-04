# Avoid using a callback in asynchronous tests (no-test-callback)

Jest allows you to pass a callback to test definitions, typically called `done`,
that is later invoked to indicate that the asynchronous test is complete.

However, that means that if your test throws (e.g. because of a failing
assertion), `done` will never be called unless you manually use `try-catch`.

```js
test('some test', done => {
  expect(false).toBe(true);
  done();
});
```

The test above will time out instead of failing the assertions, since `done` is
never called.

Correct way of doing the same thing is to wrap it in `try-catch`.

```js
test('some test', done => {
  try {
    expect(false).toBe(true);
    done();
  } catch (e) {
    done(e);
  }
});
```

However, Jest supports a second way of having asynchronous tests - using
promises.

```js
test('some test', () => {
  return new Promise(done => {
    expect(false).toBe(true);
    done();
  });
});
```

Even though `done` is never called here, the Promise will still reject, and Jest
will report the assertion error correctly.

## Rule details

This rule triggers a warning if you have a `done` callback in your test.

The following patterns are considered warnings:

```js
test('myFunction()', done => {
  // ...
});

test('myFunction()', function(done) {
  // ...
});
```

The following patterns are not considered warnings:

```js
test('myFunction()', () => {
  expect(myFunction()).toBeTruthy();
});

test('myFunction()', () => {
  return new Promise(done => {
    expect(myFunction()).toBeTruthy();
    done();
  });
});
```
