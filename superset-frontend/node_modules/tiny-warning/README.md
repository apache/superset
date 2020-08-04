# tiny-warning 🔬⚠️

[![Build Status](https://travis-ci.org/alexreardon/tiny-warning.svg?branch=master)](https://travis-ci.org/alexreardon/tiny-warning)
[![npm](https://img.shields.io/npm/v/tiny-warning.svg)](https://www.npmjs.com/package/tiny-warning) [![Downloads per month](https://img.shields.io/npm/dm/tiny-warning.svg)](https://www.npmjs.com/package/tiny-warning) [![dependencies](https://david-dm.org/alexreardon/tiny-warning.svg)](https://david-dm.org/alexreardon/tiny-warning)
[![min](https://img.shields.io/bundlephobia/min/tiny-warning.svg)](https://www.npmjs.com/package/tiny-warning)
[![minzip](https://img.shields.io/bundlephobia/minzip/tiny-warning.svg)](https://www.npmjs.com/package/tiny-warning)

A tiny [`warning`](https://www.npmjs.com/package/warning) alternative.

```js
import warning from 'tiny-warning';

warning(truthyValue, 'This should not log a warning');

warning(falsyValue, 'This should log a warning');
// console.warn('Warning: This should log a warning');
```

## API: `(condition: mixed, message: string) => void`

- `condition` is required and can be anything
- `message` is an required string that will be passed onto `console.warn`

## Why `tiny-warning`?

The [`library: warning`](https://www.npmjs.com/package/warning) supports passing in arguments to the `warning` function in a sprintf style `(condition, format, a, b, c, d, e, f)`. It has internal logic to execute the sprintf substitutions. `tiny-warning` has dropped all of the sprintf logic. `tiny-warning` allows you to pass a single string message. With [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) there is really no need for a custom message formatter to be built into the library. If you need a multi part message you can just do this: `warning(condition, 'Hello, ${name} - how are you today?')`

## Dropping your `warning` for kb savings!

We recommend using [`babel-plugin-dev-expression`](https://www.npmjs.com/package/babel-plugin-dev-expression) to remove `warning` calls from your production build. This saves you kb's as well as avoids logging warnings to the console for production.

What it does it turn your code that looks like this:

```js
warning(condition, 'My cool message that takes up a lot of kbs');
```

Into this

```js
if ('production' !== process.env.NODE_ENV) {
  warning(condition, 'My cool message that takes up a lot of kbs');
}
```

Your bundler can then drop the code in the `"production" !== process.env.NODE_ENV` block for your production builds

Final result:

```js
// nothing to see here! 👍
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
