# Enforce assertion to be made in a test body (expect-expect)

Ensure that there is at least one `expect` call made in a test.

## Rule details

This rule triggers when there is no call made to `expect` in a test, to prevent
users from forgetting to add assertions.

Examples of **incorrect** code for this rule:

```js
it('should be a test', () => {
  console.log('no assertion');
});
test('should assert something', () => {});
```

Examples of **correct** code for this rule:

```js
it('should be a test', () => {
  expect(true).toBeDefined();
});
it('should work with callbacks/async', () => {
  somePromise().then(res => expect(res).toBe('passed'));
});
```

## Options

```json
{
  "jest/expect-expect": [
    "error",
    {
      "assertFunctionNames": ["expect"]
    }
  ]
}
```

### `assertFunctionNames`

This array option whitelists the assertion function names to look for.

Examples of **incorrect** code for the `{ "assertFunctionNames": ["expect"] }`
option:

```js
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { expectSaga } from 'redux-saga-test-plan';
import { addSaga } from '../src/sagas';

test('returns sum', () =>
  expectSaga(addSaga, 1, 1)
    .returns(2)
    .run();
);
```

Examples of **correct** code for the
`{ "assertFunctionNames": ["expect", "expectSaga"] }` option:

```js
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectSaga"] }] */

import { expectSaga } from 'redux-saga-test-plan';
import { addSaga } from '../src/sagas';

test('returns sum', () =>
  expectSaga(addSaga, 1, 1)
    .returns(2)
    .run();
);
```
