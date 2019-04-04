var test = require('tape-catch');
var plus = require('1-liners/plus');
var isNative = require('lodash.isnative');
// Shim Symbol.iterator if it's not available
require('core-js/es6/symbol');

var arrayFrom = require('./polyfill');

test('Works as expected', function(is) {
  var mock = {
    0: 'a',
    1: 'b',
    2: 'c',
    length: 3,
  };

  is.deepEqual(
    arrayFrom(mock),
    ['a', 'b', 'c'],
    'with a mock object'
  );

  is.ok(
    arrayFrom(mock) instanceof Array,
    '– returning an array'
  );

  is.deepEqual(
    arrayFrom({
      0: 'a',
      1: 'b',
      2: 'c',
      'a': 'left out',
      '-1': 'left out',
      length: 3,
    }),
    ['a', 'b', 'c'],
    '– ignoring illegal indices'
  );

  is.deepEqual(
    arrayFrom({}),
    [],
    'with an empty object'
  );

  is.deepEqual(
    arrayFrom([]),
    [],
    'with an empty array'
  );

  is.deepEqual(
    (function() {return arrayFrom(arguments);})('a', 'b', 'c'),
    ['a', 'b', 'c'],
    'with the `arguments` object'
  );

  is.deepEqual(
    arrayFrom(['a', 'b', 'c']),
    ['a', 'b', 'c'],
    'with an array'
  );

  is.deepEqual(
    arrayFrom(mock, plus),
    ['a0', 'b1', 'c2'],
    'when dealing with `mapFn`'
  );

  var context = {suffix: '+'};
  is.deepEqual(
    arrayFrom(mock,
      function(item) {return (item + this.suffix);},
      context
    ),
    ['a+', 'b+', 'c+'],
    'when dealing with `mapFn` and `thisArg`'
  );

  var Transferable = function(){};
  Transferable.from = arrayFrom;

  is.ok(
    Transferable.from([1]) instanceof Transferable,
    'can be transferred to other constructor functions'
  );

  is.end();
});

test('Works for iterable objects', function(is) {

  var SetPolyfill = require('core-js/library/fn/set');

  is.deepEqual(
    arrayFrom(new SetPolyfill(['a', 'b', 'c'])),
    ['a', 'b', 'c'],
    'with Set (polyfill)'
  );

  is.deepEqual(
    arrayFrom(new SetPolyfill(['a', 'b', 'c']).values(), plus),
    ['a0', 'b1', 'c2'],
    'when dealing with `mapFn`'
  );

  var context = {suffix: '+'};
  is.deepEqual(
    arrayFrom(new SetPolyfill(['a', 'b', 'c']).keys(),
      function(item) {return (item + this.suffix);},
      context
    ),
    ['a+', 'b+', 'c+'],
    'when dealing with `mapFn` and `thisArg`'
  );

  if(typeof Set !== 'undefined' && isNative(Set)) {
    is.deepEqual(
      arrayFrom(new Set(['a', 'b', 'c'])),
      ['a', 'b', 'c'],
      'with native Set'
    );
  }

  if(typeof Map !== 'undefined' && isNative(Map)) {
    is.deepEqual(
      arrayFrom(new Map()
        .set('key1', 'value1')
        .set('key2', 'value2')
        .set('key3', 'value3')
        .keys()
      ),
      ['key1', 'key2', 'key3'],
      'with native Map'
    );
  }

  var geckoIterator = {
    value : 1,
    '@@iterator' : function(){
      var hasValue = true;
      var value = this.value;
      return {
        next: function(){
          if(hasValue) {
            hasValue = false;
            return { value: value, done: false };
          } else {
            return { done: true };
          }
        }
      };
    }
  };

  is.deepEqual(
    arrayFrom(geckoIterator),
    [1],
    'when using Gecko-based "@@iterator" property.'
  );

  geckoIterator['@@iterator'] = null;
  is.deepEqual(
    arrayFrom(geckoIterator),
    [],
    'null iterator is like no iterator');

  var Transferable = function(){};
  Transferable.from = arrayFrom;

  is.ok(Transferable.from(new SetPolyfill(['a'])) instanceof Transferable,
    'can be transferred to other constructor functions (iterable)'
  );

  is.end();
});

test('Throws when things go very wrong.', function(is) {
  is.throws(
    function() {
      arrayFrom();
    },
    TypeError,
    'when the given object is invalid'
  );

  is.throws(
    function() {
      arrayFrom({length: 0}, /invalid/);
    },
    TypeError,
    'when `mapFn` is invalid'
  );

  var invalidIterator = {};
  invalidIterator[Symbol.iterator] = {};

  is.throws(
    function() {
      arrayFrom(invalidIterator);
    },
    TypeError,
    'when an iterable has an invalid iterator property'
  );

  var noIterator = {};
  noIterator[Symbol.iterator] = function(){};

  is.throws(
    function() {
      arrayFrom(noIterator);
    },
    TypeError,
    '– no iterator returned');

  var noNext = {};
  noNext[Symbol.iterator] = function(){ return {}; };

  is.throws(
    function() {
      arrayFrom(noNext);
    },
    TypeError,
    '– no `next` function'
  );

  is.end();
});

test('Works for non-objects', function(is) {
  is.deepEqual(
    arrayFrom('a'),
    ['a'],
    'string'
  );

  is.deepEqual(
    arrayFrom('👺'),
    ['👺'],
    'string(emoji)'
  );

  is.deepEqual(
    arrayFrom('abc'),
    ['a', 'b', 'c'],
    'string'
  );

  is.deepEqual(
    arrayFrom('👺🍣🍻'),
    ['👺', '🍣', '🍻'],
    'string(emoji)'
  );

  is.deepEqual(
    arrayFrom(true),
    [],
    'boolean'
  );

  is.deepEqual(
    arrayFrom(1),
    [],
    'number'
  );

  is.deepEqual(
    arrayFrom(Symbol()),
    [],
    'symbol'
  );

  is.end();
});
