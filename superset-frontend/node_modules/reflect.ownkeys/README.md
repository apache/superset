# Reflect.ownKeys

Polyfill for ES6's [Reflect.ownKeys](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys)

## Installing

```sh
npm install reflect.ownkeys
```

## Example

```js
var ownKeys = require('reflect.ownkeys');
ownKeys({a: 1, b: 2});
// => [ "a", "b" ]
```
