var assert = require('assert');
var typed = require('../typed-function');

describe('compose', function () {

  it('should create a composed function with multiple types per argument', function() {
    var fn = typed({
      'string | number, boolean':  function () {return 'A';},
      'boolean, boolean | number': function () {return 'B';},
      'string':                    function () {return 'C';}
    });

    assert.equal(fn('str', false), 'A');
    assert.equal(fn(2, true), 'A');
    assert.equal(fn(false, true), 'B');
    assert.equal(fn(false, 2), 'B');
    assert.equal(fn('str'), 'C');
    // FIXME: should return correct error message
    assert.throws(function () {fn()},           /TypeError: Too few arguments in function unnamed \(expected: number or string or boolean, index: 0\)/);
    assert.throws(function () {fn(1,2,3)},      /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: number, index: 1\)/);
    assert.throws(function () {fn('str', 2)},   /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: number, index: 1\)/);
    assert.throws(function () {fn(true, 'str')},/TypeError: Unexpected type of argument in function unnamed \(expected: number or boolean, actual: string, index: 1\)/);
    assert.throws(function () {fn(2, 3)},       /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: number, index: 1\)/);
    assert.throws(function () {fn(2, 'str')},   /TypeError: Unexpected type of argument in function unnamed \(expected: boolean, actual: string, index: 1\)/);
  });

  // TODO: test whether the constructor throws errors when providing wrong arguments to typed(...)

  it('should compose a function with one argument', function() {
    var signatures = {
      'number': function (value) {
        return 'number:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'boolean': function (value) {
        return 'boolean:' + value;
      }
    };
    var fn = typed(signatures);

    assert.equal(fn(2), 'number:2');
    assert.equal(fn('foo'), 'string:foo');
    assert.equal(fn(false), 'boolean:false');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.strictEqual(fn.signatures['number'], signatures['number']);
    assert.strictEqual(fn.signatures['string'], signatures['string']);
    assert.strictEqual(fn.signatures['boolean'], signatures['boolean']);
  });

  it('should compose a function with multiple arguments', function() {
    var signatures = {
      'number': function (value) {
        return 'number:' + value;
      },
      'string': function (value) {
        return 'string:' + value;
      },
      'number, boolean': function (a, b) { // mind space after the comma, should be normalized by composer
        return 'number,boolean:' + a + ',' + b;
      }
    };
    var fn = typed(signatures);

    assert.equal(fn(2), 'number:2');
    assert.equal(fn('foo'), 'string:foo');
    assert.equal(fn(2, false), 'number,boolean:2,false');
    assert(fn.signatures instanceof Object);
    assert.strictEqual(Object.keys(fn.signatures).length, 3);
    assert.strictEqual(fn.signatures['number'], signatures['number']);
    assert.strictEqual(fn.signatures['string'], signatures['string']);
    assert.strictEqual(fn.signatures['number,boolean'], signatures['number, boolean']);
  });

});
