# Enforce lowercase test names (lowercase-name)

## Rule details

Enforce `it`, `test` and `describe` to have descriptions that begin with a
lowercase letter. This provides more readable test failures. This rule is not
enabled by default.

The following pattern is considered a warning:

```js
it('Adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});
```

The following pattern is not considered a warning:

```js
it('adds 1 + 2 to equal 3', () => {
  expect(sum(1, 2)).toBe(3);
});
```

## Options

```json
{
  "jest/lowercase-name": [
    "error",
    {
      "ignore": ["describe", "test"]
    }
  ]
}
```

### `ignore`

This array option whitelists function names so that this rule does not report
their usage as being incorrect. There are three possible values:

- `"describe"`
- `"test"`
- `"it"`

By default, none of these options are enabled (the equivalent of
`{ "ignore": [] }`).

Example of **correct** code for the `{ "ignore": ["describe"] }` option:

```js
/* eslint jest/lowercase-name: ["error", { "ignore": ["describe"] }] */

describe('Uppercase description');
```

Example of **correct** code for the `{ "ignore": ["test"] }` option:

```js
/* eslint jest/lowercase-name: ["error", { "ignore": ["test"] }] */

test('Uppercase description');
```

Example of **correct** code for the `{ "ignore": ["it"] }` option:

```js
/* eslint jest/lowercase-name: ["error", { "ignore": ["it"] }] */

it('Uppercase description');
```
