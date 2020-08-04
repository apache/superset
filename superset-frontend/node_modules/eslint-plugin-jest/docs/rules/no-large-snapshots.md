# disallow large snapshots (no-large-snapshots)

When using Jest's snapshot capability one should be mindful of the size of
created snapshots. As a best practice snapshots should be limited in size in
order to be more manageable and reviewable. A stored snapshot is only as good as
its review and as such keeping it short, sweet, and readable is important to
allow for thorough reviews.

## Usage

Because Jest snapshots are written with back-ticks (\` \`) which are only valid
with
[ES2015 onwards](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
you should set `parserOptions` in your config to at least allow ES2015 in order
to use this rule:

```js
parserOptions: {
  ecmaVersion: 2015,
},
```

## Rule Details

This rule looks at all Jest inline and external snapshots (files with `.snap`
extension) and validates that each stored snapshot within those files does not
exceed 50 lines (by default, this is configurable as explained in `Options`
section below).

Example of **incorrect** code for this rule:

```js
exports[`a large snapshot 1`] = `
line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10
line 11
line 12
line 13
line 14
line 15
line 16
line 17
line 18
line 19
line 20
line 21
line 22
line 23
line 24
line 25
line 26
line 27
line 28
line 29
line 30
line 31
line 32
line 33
line 34
line 35
line 36
line 37
line 38
line 39
line 40
line 41
line 42
line 43
line 44
line 45
line 46
line 47
line 48
line 49
line 50
line 51
`;
```

Example of **correct** code for this rule:

```js
exports[`a more manageable and readable snapshot 1`] = `
line 1
line 2
line 3
line 4
`;
```

## Options

This rule has option for modifying the max number of lines allowed for a
snapshot:

In an `eslintrc` file:

```json
...
  "rules": {
    "jest/no-large-snapshots": ["warn", { "maxSize": 12 }]
  }
...
```
