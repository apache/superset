# `tiny-invariant` 🔬💥

[![Build Status](https://travis-ci.org/alexreardon/tiny-invariant.svg?branch=master)](https://travis-ci.org/alexreardon/tiny-invariant)
[![npm](https://img.shields.io/npm/v/tiny-invariant.svg)](https://www.npmjs.com/package/tiny-invariant) [![dependencies](https://david-dm.org/alexreardon/tiny-invariant.svg)](https://david-dm.org/alexreardon/tiny-invariant)
[![min](https://img.shields.io/bundlephobia/min/tiny-invariant.svg)](https://www.npmjs.com/package/tiny-invariant)
[![minzip](https://img.shields.io/bundlephobia/minzip/tiny-invariant.svg)](https://www.npmjs.com/package/tiny-invariant)

A tiny [`invariant`](https://www.npmjs.com/package/invariant) alternative.

## What is `invariant`?

An `invariant` function takes a value, and if the value is [falsy](https://github.com/getify/You-Dont-Know-JS/blob/bdbe570600d4e1107d0b131787903ca1c9ec8140/up%20%26%20going/ch2.md#truthy--falsy) then the `invariant` function will throw. If the value is [truthy](https://github.com/getify/You-Dont-Know-JS/blob/bdbe570600d4e1107d0b131787903ca1c9ec8140/up%20%26%20going/ch2.md#truthy--falsy), then the function will not throw.

```js
import invariant from 'tiny-invariant';

invariant(truthyValue, 'This should not throw!');

invariant(falsyValue, 'This will throw!');
// Error('Invariant violation: This will throw!');
```

## Why `tiny-invariant`?

The [`library: invariant`](https://www.npmjs.com/package/invariant) supports passing in arguments to the `invariant` function in a sprintf style `(condition, format, a, b, c, d, e, f)`. It has internal logic to execute the sprintf substitutions. The sprintf logic is not removed in production builds. `tiny-invariant` has dropped all of the sprintf logic. `tiny-invariant` allows you to pass a single string message. With [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) there is really no need for a custom message formatter to be built into the library. If you need a multi part message you can just do this: `invariant(condition, 'Hello, ${name} - how are you today?')`

## API: `(condition: mixed, message?: string) => void`

- `condition` is required and can be anything
- `message` is an optional string

## Installation

```bash
# yarn
yarn add tiny-invariant

# bash
npm add tiny-invariant --save
```

## Dropping your `message` for kb savings!

We recommend using [`babel-plugin-dev-expression`](https://www.npmjs.com/package/babel-plugin-dev-expression) to remove the `message` argument from your `invariant` calls in production builds to save kbs!

What it does it turn your code that looks like this:

```js
invariant(condition, 'My cool message that takes up a lot of kbs');
```

Into this

```js
if (!condition) {
  if ('production' !== process.env.NODE_ENV) {
    invariant(false, 'My cool message that takes up a lot of kbs');
  } else {
    invariant(false);
  }
}
```

Your bundler can then drop the code in the `"production" !== process.env.NODE_ENV` block for your production builds

Final result:

```js
if (!condition) {
  invariant(false);
}
```

> For `rollup` use [rollup-plugin-replace](https://github.com/rollup/rollup-plugin-replace) and set `NODE_ENV` to `production` and then `rollup` will treeshake out the unused code
>
> [`Webpack` instructions](https://webpack.js.org/guides/production/#specify-the-mode)

## Builds

- We have a `es` (EcmaScript module) build (because you _know_ you want to deduplicate this super heavy library)
- We have a `cjs` (CommonJS) build
- We have a `umd` (Universal module definition) build in case you needed it

We expect `process.env.NODE_ENV` to be available at module compilation. We cache this value

## That's it!

🤘
