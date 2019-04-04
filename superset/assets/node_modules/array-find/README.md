# array-find

[![Build Status](https://travis-ci.org/stefanduberg/array-find.svg?branch=master)](https://travis-ci.org/stefanduberg/array-find)

**ES 2015 `Array.find` ponyfill.**

**Ponyfill: A polyfill that doesn't overwrite the native method.**

Find array elements. Executes a callback for each element, returns the first element for which its callback returns a truthy value.

## Usage

```javascript
var find = require('array-find');
var numbers = [1, 2, 3, 4];

find(numbers, function (element, index, array) {
  return element === 2;
});
// => 2

var robots = [{name: 'Flexo'}, {name: 'Bender'}, {name: 'Buster'}];

find(robots, function (robot, index, array) {
  return robot.name === 'Bender';
});
// => {name: 'Bender'}

find(robots, function (robot, index, array) {
  return robot.name === 'Fry';
});
// => undefined
```

Optionally pass in an object as third argument to use as `this` when executing callback.

## Install

```bash
$ npm install array-find
```

## License
MIT
