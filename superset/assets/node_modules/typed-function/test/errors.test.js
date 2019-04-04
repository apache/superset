var assert = require('assert');
var typed = require('../typed-function');

describe('errors', function () {
  it('should give correct error in case of too few arguments (named function)', function() {
    var fn = typed('fn1', {'string, boolean': function () {}});

    assert.throws(function () {fn()}, /TypeError: Too few arguments in function fn1 \(expected: string, index: 0\)/);
    assert.throws(function () {fn('foo')}, /TypeError: Too few arguments in function fn1 \(expected: boolean, index: 1\)/);
  });

  it('should give correct error in case of too few arguments (unnamed function)', function() {
    var fn = typed({'string, boolean': function () {}});

    assert.throws(function () {fn()}, /TypeError: Too few arguments in function unnamed \(expected: string, index: 0\)/);
    assert.throws(function () {fn('foo')}, /TypeError: Too few arguments in function unnamed \(expected: boolean, index: 1\)/);
  });

  it('should give correct error in case of too few arguments (varArgs)', function() {
    var fn = typed({'...string': function () {}});

    assert.throws(function () {fn()}, /TypeError: Too few arguments in function unnamed \(expected: string, index: 0\)/);
  });

  it('should give correct error in case of too few arguments (varArgs) (2)', function() {
    var fn = typed({'boolean, ...string': function () {}});

    assert.throws(function () {fn()}, /TypeError: Too few arguments in function unnamed \(expected: boolean, index: 0\)/);
    assert.throws(function () {fn(true)}, /TypeError: Too few arguments in function unnamed \(expected: string, index: 1\)/);
  });

  it('should give correct error in case of too many arguments (unnamed function)', function() {
    var fn = typed({'string, boolean': function () {}});

    assert.throws(function () {fn('foo', true, 2)}, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 3\)/);
    assert.throws(function () {fn('foo', true, 2, 1)}, /TypeError: Too many arguments in function unnamed \(expected: 2, actual: 4\)/);
  });

  it('should give correct error in case of too many arguments (named function)', function() {
    var fn = typed('fn2', {'string, boolean': function () {}});

    assert.throws(function () {fn('foo', true, 2)}, /TypeError: Too many arguments in function fn2 \(expected: 2, actual: 3\)/);
    assert.throws(function () {fn('foo', true, 2, 1)}, /TypeError: Too many arguments in function fn2 \(expected: 2, actual: 4\)/);
  });

  it('should give correct error in case of wrong type of argument (unnamed function)', function() {
    var fn = typed({'boolean': function () {}});

    assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: string, index: 0\)/);
  });

  it('should give correct error in case of wrong type of argument (named function)', function() {
    var fn = typed('fn3', {'boolean': function () {}});

    assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument in function fn3 \(expected: boolean, actual: string, index: 0\)/);
  });

  it('should give correct error in case of wrong type of argument (union args)', function() {
    var fn = typed({'boolean | string | Date': function () {}});

    assert.throws(function () {fn(2)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string or boolean or Date, actual: number, index: 0\)/);
  });

  it('should give correct error in case of conflicting union arguments', function() {
    assert.throws(function () {
      var fn = typed({
        'string | number': function () {},
        'string': function () {}
      });
    }, /Error: Signature "string" is defined twice/);
  });

  it('should give correct error in case of conflicting union arguments (2)', function() {
    assert.throws(function () {
      var fn = typed({
        '...string | number': function () {},
        '...string': function () {}
      });
    }, /Error: Conflicting types "...string|number" and "...string"/);
  });

  it('should give correct error in case of conflicting variable args', function() {
    assert.throws(function () {
      var fn = typed({
        '...string': function () {},
        'string': function () {}
      });
    }, /Error: Conflicting types "...string" and "string"/);
  });

  it('should give correct error in case of wrong type of argument (varArgs)', function() {
    var fn = typed({'...number': function () {}});

    assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 0\)/);
    assert.throws(function () {fn(2, true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/);
    assert.throws(function () {fn(2, 3, true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 2\)/);
  });

  it('should give correct error in case of wrong type of argument (nested varArgs)', function() {
    var fn = typed({'string, ...number': function () {}});

    assert.throws(function () {fn(true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: boolean, index: 0\)/);
    assert.throws(function () {fn('foo', true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 1\)/);
    assert.throws(function () {fn('foo', 2, true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 2\)/);
    assert.throws(function () {fn('foo', 2, 3, true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: number, actual: boolean, index: 3\)/);
  });

  it('should give correct error in case of wrong type of argument (union and varArgs)', function() {
    var fn = typed({'...number|boolean': function () {}});

    assert.throws(function () {fn('foo')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 0\)/);
    assert.throws(function () {fn(2, 'foo')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 1\)/);
    assert.throws(function () {fn(2, true, 'foo')}, /TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 2\)/);
  });

  it('should only list exact matches in expected types (not conversions)', function() {
    var typed2 = typed.create();
    typed2.conversions.push({
      from: 'number',
      to: 'string',
      convert: function (x) {
        return +x;
      }
    });

    var fn1 = typed2({'string': function () {}});
    var fn2 = typed2({'...string': function () {}});

    assert.throws(function () {fn1(true)},    /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: boolean, index: 0\)/);
    assert.throws(function () {fn2(true)},    /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: boolean, index: 0\)/);
    assert.throws(function () {fn2(2, true)}, /TypeError: Unexpected type of argument in function unnamed \(expected: string, actual: boolean, index: 1\)/);
  });
});
