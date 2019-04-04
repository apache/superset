[![NPM version](https://badge.fury.io/js/tslint-react.svg)](https://www.npmjs.com/package/tslint-react)
[![Downloads](http://img.shields.io/npm/dm/tslint-react.svg)](https://npmjs.org/package/tslint-react)
[![Circle CI](https://circleci.com/gh/palantir/tslint-react.svg?style=svg)](https://circleci.com/gh/palantir/tslint-react)

tslint-react
------------

Lint rules related to React & JSX for [TSLint](https://github.com/palantir/tslint/).

### Usage

tslint-react has peer dependencies on TSLint and TypeScript.

To use these lint rules with the default preset, use configuration inheritance via the `extends` keyword.
Here's a sample configuration where `tslint.json` lives adjacent to your `node_modules` folder:

```js
{
  "extends": ["tslint:latest", "tslint-react"],
  "rules": {
    // override tslint-react rules here
    "jsx-wrap-multiline": false
  }
}
```

To lint your `.ts` **and** `.tsx` files you can simply run `tslint -c tslint.json 'src/**/*.{ts,tsx}'`.

### Semantic versioning

The built-in configuration preset you get with `"extends": "tslint-react"` is semantically versioned in a manner similar to TSLint's built-in presets and the TypeScript language itself. As new rules are added to tslint-react across minor versions, stricter checks may be enabled here. Your code is not guaranteed to continue passing checks across these version bumps. If you wish to ensure that `npm upgrade` or `yarn upgrade` never breaks your build, declare a tilde dependency on this package (e.g. `"~1.0.0"`).

### Rules

- `jsx-alignment`
  - Enforces a consistent style for multiline JSX elements which promotes ease of editing via line-wise manipulations
  as well as maintainability via small diffs when changes are made.
  ```ts
  // Good:
  const element = <div
      className="foo"
      tabIndex={1}
  >
      {children}
  </div>;

  // Also Good:
  <Button
      appearance="pretty"
      disabled
      label="Click Me"
      size={size}
  />
  ```
- `jsx-ban-elements` (since v3.4.0)
  - Allows blacklisting of JSX elements with an optional explanatory message in the reported failure.
- `jsx-ban-props` (since v2.3.0)
  - Allows blacklisting of props in JSX with an optional explanatory message in the reported failure.
- `jsx-boolean-value` (since v2.5.0)
  - When using a boolean attribute in JSX, you can set the attribute value to true or omit the value. This rule will enforce one or the other to keep consistency in your code.
  - Rule options: `["always", "never"]`
  - Default is set to `always`.
- `jsx-curly-spacing` (since v1.1.0)
  - Requires _or_ bans spaces between curly brace characters in JSX.
  - Rule options: `["always", "never"]`
  - _Includes automatic code fix_
- `jsx-equals-spacing` (since v3.2.0)
  - Requires _or_ bans spaces before and after the `=` token in JSX element attributes.
  - Rule options: `["always", "never"]`
  - _Includes automatic code fix_
- `jsx-key` (since v3.2.0)
  - Warns for missing `key` props in JSX element array literals and inside return statements of `Array.prototype.map` callbacks.
    - N.B. This rule only does a simple check for `.map(...)` syntax and does not inspect computed types of expressions. As such, it may produce false positives if you use APIs that look similar to `.map()`.
  - Rule options: _none_
- `jsx-no-bind` (since v2.6.0)
  - Forbids function binding in JSX attributes. This has the same intent as `jsx-no-lambda` in helping you avoid excessive re-rendres.
  - Note that this currently only does a simple _syntactic_ check, not a _semantic_ one (it doesn't use the type checker). So it may have some
    rare false positives if you define your own `.bind` function and supply `this` as a parameter.
  - Rule options: _none_
- `jsx-no-lambda`
  - Creating new anonymous functions (with either the `function` syntax or ES2015 arrow syntax) inside the `render` call stack works against _pure component rendering_. When doing an equality check between two lambdas, React will always consider them unequal values and force the component to re-render more often than necessary.
  - Rule options: _none_
- `jsx-no-multiline-js`
  - Disallows multiline JS expressions inside JSX blocks to promote readability
  - Rule options: _none_
- `jsx-no-string-ref`
  - Passing strings to the `ref` prop of React elements is considered a legacy feature and will soon be deprecated.
    Instead, [use a callback](https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute).
  - Rule options: _none_
- `jsx-use-translation-function` (since v2.4.0)
   - Enforces use of a translation function. Plain string literals are disallowed in JSX when enabled.
   - Rule options: `["allow-punctuation", "allow-htmlentities"]`
   - Off by default
- `jsx-self-close` (since v0.4.0)
  - Enforces that JSX elements with no children are self-closing.
  ```ts
  // bad
  <div className="foo"></div>
  // good
  <div className="foo" />
  ```
  - Rule options: _none_
- `jsx-space-before-trailing-slash`
  - Checks that self-closing JSX elements have a space before the '/>' part.
  - Rule options: _none_
- `jsx-wrap-multiline` (since v2.1)
  - Enforces that multiline JSX expressions are wrapped with parentheses.
  - Opening parenthesis must be followed by a newline.
  - Closing parenthesis must be preceded by a newline.
  ```ts
  // bad
  const button = <button type="submit">
      Submit
  </button>;
  // good
  const button = (
      <button type="submit">
          Submit
      </button>
  );
  ```

### Development

We track rule suggestions on Github issues -- [here's a useful link](https://github.com/palantir/tslint-react/issues?q=is%3Aissue+is%3Aopen+label%3A%22Type%3A+Rule+Suggestion%22)
to view all the current suggestions. Tickets are roughly triaged by priority (P1, P2, P3).

We're happy to accept PRs for new rules, especially those marked as [Status: Accepting PRs](https://github.com/palantir/tslint-react/issues?q=is%3Aissue+is%3Aopen+label%3A%22Status%3A+Accepting+PRs%22).
If submitting a PR, try to follow the same style conventions as the [core TSLint project](https://github.com/palantir/tslint).

Quick Start (requires Node v6+, yarn v0.22+):

1. `yarn`
1. `yarn verify`
1. `yarn lint`

### Changelog

See the Github [release history](https://github.com/palantir/tslint-react/releases).
