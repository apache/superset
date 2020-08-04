var assert = require('assert');
var typed = require('../typed-function');

describe('any type', function () {

  it('should compose a function with one any type argument', function() {
    var fn = typed({
      'any': function (value) {
        return 'any:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'boolean': function (value) {
        return 'boolean:' + value;
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.equal(fn(2), 'any:2');
    assert.equal(fn([1,2,3]), 'any:1,2,3');
    assert.equal(fn('foo'), 'string:foo');
    assert.equal(fn(false), 'boolean:false');
  });

  it('should compose a function with multiple any type arguments (1)', function() {
    var fn = typed({
      'any,boolean': function () {
        return 'any,boolean';
      },
      'any,string': function () {
        return 'any,string';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn([],true), 'any,boolean');
    assert.equal(fn(2,'foo'), 'any,string');
    assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean, actual: Date, index: 1\)/);
    assert.throws(function () {fn(2, 2)},           /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean, actual: number, index: 1\)/);
    assert.throws(function () {fn(2)},              /TypeError: Too few arguments in function unnamed \(expected: string or boolean, index: 1\)/);
  });

  it('should compose a function with multiple any type arguments (2)', function() {
    var fn = typed({
      'any,boolean': function () {
        return 'any,boolean';
      },
      'any,number': function () {
        return 'any,number';
      },
      'string,any': function () {
        return 'string,any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.equal(fn([],true), 'any,boolean');
    assert.equal(fn([],2), 'any,number');
    assert.equal(fn('foo', 2), 'string,any');
    assert.throws(function () {fn([], new Date())}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: Date, index: 1\)/);
    assert.throws(function () {fn([], 'foo')},      /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 1\)/)
  });

  it('should compose a function with multiple any type arguments (3)', function() {
    var fn = typed({
      'string,any': function () {
        return 'string,any';
      },
      'any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('foo', 2), 'string,any');
    assert.equal(fn([]), 'any');
    assert.equal(fn('foo'), 'any');
    assert.throws(function () {fn()}, /TypeError: Too few arguments in function unnamed \(expected: string or any, index: 0\)/);
    assert.throws(function () {fn([], 'foo')}, /TypeError: Too many arguments in function unnamed \(expected: 1, actual: 2\)/);
    assert.throws(function () {fn([], 'foo', 4)}, /TypeError: Too many arguments in function unnamed \(expected: 1, actual: 3\)/);
  });

  it('should compose a function with multiple any type arguments (4)', function() {
    var fn = typed('fn1', {
      'number,number': function () {
        return 'number,number';
      },
      'any,string': function () {
        return 'any,string';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn(2, 2), 'number,number');
    assert.equal(fn(2, 'foo'), 'any,string');
    assert.throws(function () {fn('foo')}, /TypeError: Too few arguments in function fn1 \(expected: string, index: 1\)/);
    assert.throws(function () {fn(1,2,3)}, /TypeError: Too many arguments in function fn1 \(expected: 2, actual: 3\)/);
  });

  it('should compose a function with multiple any type arguments (5)', function() {
    var fn = typed({
      'string,string': function () {
        return 'string,string';
      },
      'any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('foo', 'bar'), 'string,string');
    assert.equal(fn([]), 'any');
    assert.equal(fn('foo'), 'any');
    assert.throws(function () {fn('foo', 'bar', 5)}, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 3\)/);
    assert.throws(function () {fn('foo', 2, 5)}, /TypeError: Too many arguments in function unnamed \(expected: 1, actual: 3\)/);
    assert.throws(function () {fn('foo', 5)}, /TypeError: Too many arguments in function unnamed \(expected: 1, actual: 2\)/);
  });

  it('var arg any type arguments should only handle unmatched types', function() {
    var fn = typed({
      'Array,string': function () {
        return 'Array,string';
      },
      '...': function () {
        return 'any';
      }
    });

    assert.equal(fn([], 'foo'), 'Array,string');
    assert.equal(fn([], 'foo', 'bar'), 'any');
    assert.equal(fn('string'), 'any');
    assert.equal(fn(2), 'any');
    assert.equal(fn(2,3,4), 'any');
    assert.equal(fn([]), 'any');
    assert.throws(function () {fn()}, /TypeError: Too few arguments in function unnamed \(expected: Array or any, index: 0\)/);
  });

  it('multiple use of any', function() {
    var fn = typed({
      'number,number': function () {
        return 'numbers';
      },
      'any,any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('a','b'), 'any');
    assert.equal(fn(1,1), 'numbers');
    assert.equal(fn(1,'b'), 'any');
    assert.equal(fn('a',1), 'any');
  });

  it('use one any in combination with vararg', function() {
    var fn = typed({
      'number': function () {
        return 'numbers';
      },
      'any,...any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('a','b'), 'any');
    assert.equal(fn(1), 'numbers');
    assert.equal(fn(1,'b'), 'any');
    assert.equal(fn('a',2), 'any');
    assert.equal(fn(1,2), 'any');
    assert.equal(fn(1,2,3), 'any');
  });

  it('use multi-layered any in combination with vararg', function() {
    var fn = typed({
      'number,number': function () {
        return 'numbers';
      },
      'any,any,...any': function () {
        return 'any';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('a','b','c'), 'any');
    assert.equal(fn(1,2), 'numbers');
    assert.equal(fn(1,'b',2), 'any');
    assert.equal(fn('a',2,3), 'any');
    assert.equal(fn(1,2,3), 'any');
  });

  it('should permit multi-layered use of any', function() {
    var fn = typed({
      'any,any': function () {
        return 'two';
      },
      'number,number,string': function () {
        return 'three';
      }
    });

    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 2);
    assert.equal(fn('a','b'), 'two');
    assert.equal(fn(1,1), 'two');
    assert.equal(fn(1,1,'a'), 'three');
    assert.throws(function () {fn(1,1,1)}, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 3\)/);
  });

});
