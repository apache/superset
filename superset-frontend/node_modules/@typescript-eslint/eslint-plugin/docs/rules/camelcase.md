# Enforce camelCase naming convention (`camelcase`)

When it comes to naming variables, style guides generally fall into one of two
camps: camelCase (`variableName`) and underscores (`variable_name`). This rule
focuses on using the camelCase approach. If your style guide calls for
camelCasing your variable names, then this rule is for you!

## Rule Details

This rule looks for any underscores (`_`) located within the source code.
It ignores leading and trailing underscores and only checks those in the middle
of a variable name. If ESLint decides that the variable is a constant
(all uppercase), then no warning will be thrown. Otherwise, a warning will be
thrown. This rule only flags definitions and assignments but not function calls.
In case of ES6 `import` statements, this rule only targets the name of the
variable that will be imported into the local module scope.

**_This rule was taken from the ESLint core rule `camelcase`._**
**_Available options and test cases may vary depending on the version of ESLint installed in the system._**

## Options

```cjson
{
    // note you must disable the base rule as it can report incorrect errors
    "camelcase": "off",
    "@typescript-eslint/camelcase": ["error", { "properties": "always" }]
}
```

This rule has an object option:

- `"properties": "never"` (default) does not check property names
- `"properties": "always"` enforces camelCase style for property names
- `"genericType": "never"` (default) does not check generic identifiers
- `"genericType": "always"` enforces camelCase style for generic identifiers
- `"ignoreDestructuring": false` (default) enforces camelCase style for destructured identifiers
- `"ignoreDestructuring": true` does not check destructured identifiers
- `allow` (`string[]`) list of properties to accept. Accept regex.

### properties: "always"

Examples of **incorrect** code for this rule with the default `{ "properties": "always" }` option:

```js
/*eslint @typescript-eslint/camelcase: "error"*/

import { no_camelcased } from 'external-module';

var my_favorite_color = '#112C85';

function do_something() {
  // ...
}

obj.do_something = function() {
  // ...
};

function foo({ no_camelcased }) {
  // ...
}

function foo({ isCamelcased: no_camelcased }) {
  // ...
}

function foo({ no_camelcased = 'default value' }) {
  // ...
}

var obj = {
  my_pref: 1,
};

var { category_id = 1 } = query;

var { foo: no_camelcased } = bar;

var { foo: bar_baz = 1 } = quz;
```

Examples of **correct** code for this rule with the default `{ "properties": "always" }` option:

```js
/*eslint @typescript-eslint/camelcase: "error"*/

import { no_camelcased as camelCased } from 'external-module';

var myFavoriteColor = '#112C85';
var _myFavoriteColor = '#112C85';
var myFavoriteColor_ = '#112C85';
var MY_FAVORITE_COLOR = '#112C85';
var foo = bar.baz_boom;
var foo = { qux: bar.baz_boom };

obj.do_something();
do_something();
new do_something();

var { category_id: category } = query;

function foo({ isCamelCased }) {
  // ...
}

function foo({ isCamelCased: isAlsoCamelCased }) {
  // ...
}

function foo({ isCamelCased = 'default value' }) {
  // ...
}

var { categoryId = 1 } = query;

var { foo: isCamelCased } = bar;

var { foo: isCamelCased = 1 } = quz;
```

### `properties: "never"`

Examples of **correct** code for this rule with the `{ "properties": "never" }` option:

```js
/*eslint @typescript-eslint/camelcase: ["error", {properties: "never"}]*/

var obj = {
  my_pref: 1,
};
```

### `genericType: "always"`

Examples of **incorrect** code for this rule with the default `{ "genericType": "always" }` option:

```typescript
/* eslint @typescript-eslint/camelcase: ["error", { "genericType": "always" }] */

interface Foo<t_foo> {}
function foo<t_foo>() {}
class Foo<t_foo> {}
type Foo<t_foo> = {};
class Foo {
  method<t_foo>() {}
}

interface Foo<t_foo extends object> {}
function foo<t_foo extends object>() {}
class Foo<t_foo extends object> {}
type Foo<t_foo extends object> = {};
class Foo {
  method<t_foo extends object>() {}
}

interface Foo<t_foo = object> {}
function foo<t_foo = object>() {}
class Foo<t_foo = object> {}
type Foo<t_foo = object> = {};
class Foo {
  method<t_foo = object>() {}
}
```

Examples of **correct** code for this rule with the default `{ "genericType": "always" }` option:

```typescript
/* eslint @typescript-eslint/camelcase: ["error", { "genericType": "always" }] */

interface Foo<T> {}
function foo<t>() {}
class Foo<T> {}
type Foo<T> = {};
class Foo {
  method<T>() {}
}

interface Foo<T extends object> {}
function foo<T extends object>() {}
class Foo<T extends object> {}
type Foo<T extends object> = {};
class Foo {
  method<T extends object>() {}
}

interface Foo<T = object> {}
function foo<T = object>() {}
class Foo<T = object> {}
type Foo<T = object> = {};
class Foo {
  method<T = object>() {}
}
```

### `genericType: "never"`

Examples of **correct** code for this rule with the `{ "genericType": "never" }` option:

```typescript
/* eslint @typescript-eslint/camelcase: ["error", { "genericType": "never" }] */

interface Foo<t_foo> {}
function foo<t_foo>() {}
class Foo<t_foo> {}
type Foo<t_foo> = {};
class Foo {
  method<t_foo>() {}
}

interface Foo<t_foo extends object> {}
function foo<t_foo extends object>() {}
class Foo<t_foo extends object> {}
type Foo<t_foo extends object> = {};
class Foo {
  method<t_foo extends object>() {}
}

interface Foo<t_foo = object> {}
function foo<t_foo = object>() {}
class Foo<t_foo = object> {}
type Foo<t_foo = object> = {};
class Foo {
  method<t_foo = object>() {}
}
```

### `ignoreDestructuring: false`

Examples of **incorrect** code for this rule with the default `{ "ignoreDestructuring": false }` option:

```js
/*eslint @typescript-eslint/camelcase: "error"*/

var { category_id } = query;

var { category_id = 1 } = query;

var { category_id: category_id } = query;

var { category_id: category_alias } = query;

var { category_id: categoryId, ...other_props } = query;
```

### `ignoreDestructuring: true`

Examples of **incorrect** code for this rule with the `{ "ignoreDestructuring": true }` option:

```js
/*eslint @typescript-eslint/camelcase: ["error", {ignoreDestructuring: true}]*/

var { category_id: category_alias } = query;

var { category_id, ...other_props } = query;
```

Examples of **correct** code for this rule with the `{ "ignoreDestructuring": true }` option:

```js
/*eslint @typescript-eslint/camelcase: ["error", {ignoreDestructuring: true}]*/

var { category_id } = query;

var { category_id = 1 } = query;

var { category_id: category_id } = query;
```

## allow

Examples of **correct** code for this rule with the `allow` option:

```js
/*eslint @typescript-eslint/camelcase: ["error", {allow: ["UNSAFE_componentWillMount"]}]*/

function UNSAFE_componentWillMount() {
  // ...
}
```

```js
/*eslint @typescript-eslint/camelcase: ["error", {allow: ["^UNSAFE_"]}]*/

function UNSAFE_componentWillMount() {
  // ...
}

function UNSAFE_componentWillMount() {
  // ...
}
```

## When Not To Use It

If you have established coding standards using a different naming convention (separating words with underscores), turn this rule off.

<sup>Taken with ❤️ [from ESLint core](https://github.com/eslint/eslint/blob/master/docs/rules/camelcase.md)</sup>
