# eslint-config-prettier [![Build Status][travis-badge]][travis]

Turns off all rules that are unnecessary or might conflict with [Prettier].

This lets you use you favorite shareable config without letting its stylistic
choices get in the way when using Prettier.

## Installation

Tip: First, you might be interested in installing [eslint-plugin-prettier].
Follow the instructions over there. This is optional, though.

Install eslint-config-prettier:

```
$ npm install --save-dev eslint-config-prettier
```

Then, add eslint-config-prettier to the "extends" array in your `.eslintrc.*`
file. Make sure to put it **last,** so it gets the chance to override other
configs.

```json
{
  "extends": [
    "prettier"
  ]
}
```

A few ESLint plugins are supported as well:

- [eslint-plugin-flowtype]
- [eslint-plugin-react]
- [eslint-plugin-standard]

Add extra exclusions for the plugins you use like so:

```json
{
  "extends": [
    "prettier",
    "prettier/flowtype",
    "prettier/react",
    "prettier/standard"
  ]
}
```

## CLI helper tool

eslint-config-prettier also ships with a little CLI tool to help you check if
your configuration contains any rules that are unnecessary or conflict with
Prettier.

First, add a script for it to package.json:

```json
{
  "scripts": {
    "eslint-check": "eslint --print-config .eslintrc.js | eslint-config-prettier-check"
  }
}
```

Then run `npm run eslint-check`.

(Swap out .eslintrc.js with the path to your config if needed.)

Exit codes:

- 0: No problems found.
- 1: Unexpected error.
- 2: Conflicting rules found.

## Example configuration

```json
{
  "extends": [
    "standard",
    "plugin:flowtype/recommended",
    "plugin:react/recommended",
    "prettier",
    "prettier/flowtype",
    "prettier/react",
    "prettier/standard"
  ],
  "plugins": [
    "flowtype",
    "react",
    "prettier",
    "standard"
  ],
  "parserOptions": {
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "env": {
    "es6": true,
    "node": true
  },
  "rules": {
    "prettier/prettier": "error"
  }
}
```

## Special rules

There a few rules that eslint-config-prettier disables that actually can be
enabled in some cases.

- Some require certain options. The CLI helper tool validates this.
- Some require special attention when writing code. The CLI helper tool warns
  you if any of those rules are enabled, but can’t tell if anything is
  problematic.

For maximum ease of use, the special rules are disabled by default. If you want
them, you need to explicitly specify them in your ESLint config.

### [curly]

**This rule requires certain options.**

If a block (for example after `if`, `else`, `for` or `while`) contains only one
statement, JavaScript allows omitting the curly braces around that statement.
This rule enforces if or when those optional curly braces should be omitted.

If you use the `"multi-line"` or `"multi-or-nest"` option, the rule can conflict
with Prettier.

For example, the `"multi-line"` option allows this line:

```js
if (cart.items && cart.items[0] && cart.items[0].quantity === 0) updateCart(cart);
```

However, Prettier might consider the line too long and turn it into the
following, which the `"multi-line"` option does _not_ allow:

```js
if (cart.items && cart.items[0] && cart.items[0].quantity === 0)
  updateCart(cart);
```

If you like this rule, it can be used just fine with Prettier as long as you
don’t use the `"multi-line"` or `"multi-or-nest"` option.

Example configuration:

```json
{
  "rules": {
    "curly": ["error", "all"]
  }
}
```

### [lines-around-comment]

**This rule can be used with certain options.**

This rule requires empty lines before and/or after comments. Prettier preserves
blank lines, with two exceptions:

- Several blank lines in a row are collapsed into a single blank line. This is
  fine.
- Blank lines at the beginning and end of blocks, objects and arrays are always
  removed. This may lead to conflicts.

By default, ESLint requires a blank line above the comment is this case:

```js
if (result) {

  /* comment */
  return result;
}
```

However, Prettier removes the blank line:

```js
if (result) {
  /* comment */
  return result;
}
```

If you like this rule, it can be used just fine with Prettier as long as you add
some extra configuration to allow comments at the start and end of blocks,
objects and arrays.

Example configuration:

```json
{
  "rules": {
    "lines-around-comment": [
      "error",
      {
        "beforeBlockComment": true,
        "afterBlockComment": true,
        "beforeLineComment": true,
        "afterLineComment": true,
        "allowBlockStart": true,
        "allowBlockEnd": true,
        "allowObjectStart": true,
        "allowObjectEnd": true,
        "allowArrayStart": true,
        "allowArrayEnd": true
      }
    ]
  }
}
```

### [max-len]

**This rule requires special attention when writing code.**

Usually, Prettier takes care of following a maximum line length automatically.
However, there are cases where Prettier can’t do anything, such as for long
strings, regular expressions and comments. Those need to be split up by a human.

If you’d like to enforce an even stricter maximum line length policy than
Prettier can provide automatically, you can enable this rule. Just remember to
keep `max-len`’s options and Prettier’s `printWidth` option in sync.

Keep in mind that you might have to refactor code slightly if Prettier formats
lines in a way that the `max-len` rule does not approve of.

Example configuration:

```json
{
  "rules": {
    "max-len": ["error", {"code": 80, "ignoreUrls": true}]
  }
}
```

### [no-confusing-arrow]

**This rule requires certain options.**

For example, the rule could warn about this line:

```js
var x = a => 1 ? 2 : 3;
```

By default, ESLint suggests switching to an explicit return:

```js
var x = a => { return 1 ? 2 : 3; };
```

That causes no problems with Prettier.

With `{allowParens: true}`, adding parentheses is also considered a valid way to
avoid the arrow confusion:

```js
var x = a => (1 ? 2 : 3);
```

While Prettier keeps thoses parentheses, it removes them if the line is long
enough to introduce a line break:

```js
EnterpriseCalculator.prototype.calculateImportantNumbers = inputNumber =>
  1 ? 2 : 3;
```

If you like this rule, it can be used just fine with Prettier as long as the
`allowParens` option is off.

Example configuration:

```json
{
  "rules": {
    "no-confusing-arrow": "error"
  }
}
```

### [no-mixed-operators]

**This rule requires special attention when writing code.**

This rule forbids mixing certain operators, such as `&&` and `||`.

For example, the rule could warn about this line:

```js
var foo = a + b * c;
```

The rule suggests adding parentheses, like this:

```js
var foo = a + (b * c);
```

However, Prettier removes many “unnecessary” parentheses, turning it back to:

```js
var foo = a + b * c;
```

If you want to use this rule with Prettier, you need to split the expression
into another variable:

```js
var bar = b * c;
var foo = a + bar;
```

Keep in mind that Prettier prints _some_ “unnecessary” parentheses, though:

```js
var foo = (a && b) || c;
```

Example configuration:

```json
{
  "rules": {
    "no-mixed-operators": "error"
  }
}
```

### [no-tabs]

**This rule requires certain Prettier options.**

This rule disallows the use of tab characters at all. It can be used just fine
with Prettier as long as you don’t configure Prettier to indent using tabs.

Example configuration:

```json
{
  "rules": {
    "no-tabs": "error"
  }
}
```

### [no-unexpected-multiline]

**This rule requires special attention when writing code.**

This rule disallows confusing multiline expressions where a newline looks like
it is ending a statement, but is not.

For example, the rule could warn about this:

```js
var hello = "world"
[1, 2, 3].forEach(addNumber)
```

Prettier usually formats this in a way that makes it obvious that a semicolon
was missing:

```js
var hello = "world"[(1, 2, 3)].forEach(addNumber);
```

However, there are cases where Prettier breaks things into several lines such
that the `no-unexpected-multiline` conflicts.

```js
const value = text.trim().split("\n")[position].toLowerCase();
```

Prettier breaks it up into several lines, though, causing a conflict:

```js
const value = text
  .trim()
  .split("\n")
  [position].toLowerCase();
```

If you like this rule, it can usually be used with Prettier without problems,
but occasionally you might need to either temporarily disable the rule or
refactor your code.

```js
const value = text
  .trim()
  .split("\n")
  // eslint-disable-next-line no-unexpected-multiline
  [position].toLowerCase();

// Or:

const lines = text.trim().split("\n");
const value = lines[position].toLowerCase();
```

**Note:** If you _do_ enable this rule, you have to run ESLint and Prettier as
two separate steps (and ESLint first) in order to get any value out of it.
Otherwise Prettier might reformat your code in such a way that ESLint never gets
a chance to report anything (as seen in the first example).

Example configuration:

```json
{
  "rules": {
    "no-unexpected-multiline": "error"
  }
}
```

### [quotes]

**This rule requires certain options.**

If you’d like to enforce the use of backticks rather than single or double
quotes for strings, you can enable this rule. Otherwise, there’s no need to.
Just remember to enable the `"backtick"` option!

Example configuration:

```json
{
  "rules": {
    "quotes": ["error", "backtick"]
  }
}
```


## Contributing

eslint-config-prettier has been tested with:

- ESLint 4.12.0 (eslint-config-prettier 2.1.1 and older were tested with ESLint 3.x)
- prettier 1.8.2
- eslint-plugin-flowtype 2.39.1
- eslint-plugin-react 7.10.0
- eslint-plugin-standard 3.0.1

Have new rules been added since those versions? Have we missed any rules? Is
there a plugin you would like to see exclusions for? Open an issue or a pull
request!

If you’d like to add support for eslint-plugin-foobar, this is how you’d go
about it:

First, create `foobar.js`:

```js
"use strict";

module.exports = {
  rules: {
    "foobar/some-rule": "off"
  }
};
```

Then, create `test-lint/foobar.js`:

```js
/* eslint-disable quotes */
"use strict";

// Prettier does not want spaces before the parentheses, but
// eslint-config-foobar wants one.
console.log ();
```

`test-lint/foobar.js` must fail when used with eslint-plugin-foobar and
eslint-plugin-prettier at the same time – until `"prettier/foobar"` is added to
the "extends" property of an ESLint config.

Finally, you need to mention the plugin in several places:

- Add `"foobar.js"` to the "files" field in `package.json`.
- Add eslint-plugin-foobar to the "devDependencies" field in `package.json`.
- Make sure that at least one rule from eslint-plugin-foobar gets used in
  `.eslintrc.base.js`.
- Add it to the list of supported plugins, to the example config and to
  Contributing section in `README.md`.

When you’re done, run `npm test` to verify that you got it all right. It runs
several other npm scripts:

- `"test:lint"` makes sure that the files in `test-lint/` pass ESLint when
  the exclusions from eslint-config-prettier are used. It also lints the code of
  eslint-config-prettier itself.
- `"test:lint-verify-fail"` is run by a test in `test/lint-verify-fail.js`.
- `"test:lint-rules"` is run by a test in `test/rules.js`.
- `"test:ava"` runs unit tests that check a number of things:
  - That eslint-plugin-foobar is mentioned in all the places shown above.
  - That no unknown rules are turned off. This helps catching typos, for
    example.
  - That the CLI works.
- `"test:cli-sanity"` is a sanity check for the CLI.

## License

[MIT](LICENSE).

[Prettier]: https://github.com/prettier/prettier
[curly]: https://eslint.org/docs/rules/curly
[eslint-plugin-flowtype]: https://github.com/gajus/eslint-plugin-flowtype
[eslint-plugin-prettier]: https://github.com/prettier/eslint-plugin-prettier
[eslint-plugin-react]: https://github.com/yannickcr/eslint-plugin-react
[eslint-plugin-standard]: https://github.com/xjamundx/eslint-plugin-standard
[lines-around-comment]: https://eslint.org/docs/rules/lines-around-comment
[max-len]: https://eslint.org/docs/rules/max-len
[no-confusing-arrow]: https://eslint.org/docs/rules/no-confusing-arrow
[no-mixed-operators]: https://eslint.org/docs/rules/no-mixed-operators
[no-tabs]: https://eslint.org/docs/rules/no-tabs
[no-unexpected-multiline]: https://eslint.org/docs/rules/no-unexpected-multiline
[quotes]: https://eslint.org/docs/rules/quotes
[travis-badge]: https://travis-ci.org/prettier/eslint-config-prettier.svg?branch=master
[travis]: https://travis-ci.org/prettier/eslint-config-prettier
