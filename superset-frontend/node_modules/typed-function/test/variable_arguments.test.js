var assert = require('assert');
var typed = require('../typed-function');
var strictEqualArray = require('./strictEqualArray');

describe('variable arguments', function () {

  it('should create a typed function with variable arguments', function() {
    var sum = typed({
      '...number': function (values) {
        assert(Array.isArray(values));
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
          sum += values[i];
        }
        return sum;
      }
    });

    assert.equal(sum(2), 2);
    assert.equal(sum(2,3,4), 9);
    assert.throws(function () {sum()},                /TypeError: Too few arguments in function unnamed \(expected: number, index: 0\)/);
    assert.throws(function () {sum(true)},            /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 0\)/);
    assert.throws(function () {sum('string')},        /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 0\)/);
    assert.throws(function () {sum(2, 'string')},     /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/);
    assert.throws(function () {sum(2, 3, 'string')},  /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 2\)/);
  });

  it('should create a typed function with variable arguments (2)', function() {
    var fn = typed({
      'string, ...number': function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      }
    });

    assert.equal(fn('foo', 2), 'foo: 2');
    assert.equal(fn('foo', 2, 4), 'foo: 2, 4');
    assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/);
    assert.throws(function () {fn('string')}, /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/);
    assert.throws(function () {fn('string', 'string')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/);
  });

  it('should create a typed function with any type arguments (1)', function() {
    var fn = typed({
      'string, ...any': function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      }
    });

    assert.equal(fn('foo', 2), 'foo: 2');
    assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar');
    assert.equal(fn('foo', 'bar'), 'foo: bar');
    assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/);
    assert.throws(function () {fn('string')}, /TypeError: Too few arguments in function unnamed \(expected: any, index: 1\)/);
  });

  it('should create a typed function with implicit any type arguments', function() {
    var fn = typed({
      'string, ...': function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      }
    });

    assert.equal(fn('foo', 2), 'foo: 2');
    assert.equal(fn('foo', 2, true, 'bar'), 'foo: 2, true, bar');
    assert.equal(fn('foo', 'bar'), 'foo: bar');
    assert.throws(function () {fn(2, 4)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: number, index: 0\)/);
    assert.throws(function () {fn('string')}, /TypeError: Too few arguments in function unnamed \(expected: any, index: 1\)/);
  });

  it('should create a typed function with any type arguments (2)', function() {
    var fn = typed({
      'any, ...number': function (any, values) {
        assert(Array.isArray(values));
        return any + ': ' + values.join(', ');
      }
    });

    assert.equal(fn('foo', 2), 'foo: 2');
    assert.equal(fn(1, 2, 4), '1: 2, 4');
    assert.equal(fn(null, 2, 4), 'null: 2, 4');
    assert.throws(function () {fn('string')},           /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/);
    assert.throws(function () {fn('string', 'string')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: string, index: 1\)/);
  });

  it('should create a typed function with union type arguments', function() {
    var fn = typed({
      '...number|string': function (values) {
        assert(Array.isArray(values));
        return values;
      }
    });

    strictEqualArray(fn(2,3,4), [2,3,4]);
    strictEqualArray(fn('a','b','c'), ['a','b','c']);
    strictEqualArray(fn('a',2,'c',3), ['a',2,'c',3]);
    assert.throws(function () {fn()},               /TypeError: Too few arguments in function unnamed \(expected: number or string, index: 0\)/);
    assert.throws(function () {fn('string', true)}, /TypeError: Unexpected type of argument. Index: 1 in function unnamed \(expected: string | number/);
    assert.throws(function () {fn(2, false)},       /TypeError: Unexpected type of argument. Index: 1 in function unnamed \(expected: string | number/);
    assert.throws(function () {fn(2, 3, false)},    /TypeError: Unexpected type of argument. Index: 2 in function unnamed \(expected: string | number/);
  });

  it('should create a composed function with variable arguments', function() {
    var fn = typed({
      'string, ...number': function (str, values) {
        assert.equal(typeof str, 'string');
        assert(Array.isArray(values));
        return str + ': ' + values.join(', ');
      },

      '...boolean': function (values) {
        assert(Array.isArray(values));
        return 'booleans';
      }
    });

    assert.equal(fn('foo', 2), 'foo: 2');
    assert.equal(fn('foo', 2, 4), 'foo: 2, 4');
    assert.equal(fn(true, false, false), 'booleans');
    assert.throws(function () {fn(2, 4)},           /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean, actual: number, index: 0\)/);
    assert.throws(function () {fn('string')},       /TypeError: Too few arguments in function unnamed \(expected: number, index: 1\)/);
    assert.throws(function () {fn('string', true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/);
  });

  it('should continue with other options if varArgs do not match', function() {
    var fn = typed({
      '...number': function (values) {
        return '...number';
      },

      'Object': function (value) {
        return 'Object';
      }
    });

    assert.equal(fn(2, 3), '...number');
    assert.equal(fn(2), '...number');
    assert.equal(fn({}), 'Object');
  });

  it('should throw an error in case of unexpected variable arguments', function() {
    assert.throws(function () {
      typed({'...number, string': function () {}});
    }, /SyntaxError: Unexpected variable arguments operator "..."/);
  });

  it('should correctly interact with any', function() {
    var fn = typed({
      'string': function () {
        return 'one';
      },
      '...any': function () {
        return 'two';
      }
    });

    assert.equal(fn('a'), 'one');
    assert.equal(fn([]), 'two');
    assert.equal(fn('a','a'), 'two');
    assert.equal(fn('a',[]), 'two');
    assert.equal(fn([],[]), 'two');
  });

});
