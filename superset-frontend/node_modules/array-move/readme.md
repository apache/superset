# array-move [![Build Status](https://travis-ci.org/sindresorhus/array-move.svg?branch=master)](https://travis-ci.org/sindresorhus/array-move)

> Move an array item to a different position


## Install

```
$ npm install array-move
```


## Usage

```js
const arrayMove = require('array-move');

const input = ['a', 'b', 'c'];

arrayMove(input, 1, 2);
//=> ['a', 'c', 'b']

arrayMove(input, -1, 0);
//=> ['c', 'a', 'b']

arrayMove(input, -2, -3);
//=> ['b', 'a', 'c']
```


## API

### arrayMove(array, from, to)

Returns a new array with the item moved to the new position.

### arrayMove.mutate(array, from, to)

Moves the item to the new position in the `array` array. Useful for huge arrays where absolute performance is needed.

#### array

Type: `Array`

#### from

Type: `number`

Index of item to move. If negative, it will begin that many elements from the end.

#### to

Type: `number`

Index of where to move the item. If negative, it will begin that many elements from the end.
