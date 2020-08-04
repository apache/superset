'use strict';

var test = require('tape').test;
var find = require('./find.js');

test('can find an element', function (t) {
  var arr = [1, 2, 3, 4, 5];
  var found = find(arr, function (el) {
    return el === 2;
  });
  t.equal(2, found);
  t.end();
});

test('can find an element from an object', function (t) {
  var arr = [{name: 'adam'}, {name: 'eve'}, {name: 'john'}];
  var found = find(arr, function (el) {
    return el.name === 'eve';
  });
  t.deepEqual({name: 'eve'}, found);
  t.end();
});

test('returns undefined if no callback returns true', function (t) {
  var arr = [6, 7, 8];
  var found = find(arr, function (el) {
    return el === 1;
  });
  t.equal(found, undefined);
  t.end();
});

test('setting object as thisArg', function (t) {
  t.plan(3);
  function Car() {}
  var car = new Car();
  var arr = [1, 2, 3];
  find(arr, function (el) {
    t.ok(this instanceof Car, 'this should be instanceof Car');
  }, car);
});

test('loop should exit on first find', function (t) {
  t.plan(3);
  var arr = [1, 2, 3, 4, 5];
  find(arr, function (el, index) {
    t.ok(true, 'element ' + index);
    return el === 3;
  });
});

test(
  'third callback argument array should be equal to first argument array',
  function (t) {
    t.plan(3);
    var arr = [1, 2, 3];
    find(arr, function (el, index, array) {
      t.deepEqual(arr, array);
    });
  }
);

test(
  'should throw TypeError if second argument is not a function',
  function (t) {
    t.plan(1);
    var arr = [1, 2, 3];
    try {
      find(arr, 'string');
    } catch (e) {
      t.ok(e instanceof TypeError);
    }
  }
);
