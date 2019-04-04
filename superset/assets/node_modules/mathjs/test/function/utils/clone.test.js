var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index');

describe('clone', function() {

  it('should clone a boolean', function() {
    assert.strictEqual(math.clone(true), true);
    assert.strictEqual(math.clone(false), false);
  });

  it('should clone null', function() {
    assert.strictEqual(math.clone(null), null);
  });

  it('should clone a number', function() {
    var a = 1;
    var b = math.clone(a);
    a = 2;
    assert.strictEqual(b, 1);
  });

  it('should throw an error on wrong number of arguments', function() {
    assert.throws (function () {math.clone()}, /TypeError: Too few arguments/);
    assert.throws (function () {math.clone(2, 4)}, /TypeError: Too many arguments/);
  });

  it('should clone a bignumber', function() {
    var a = math.bignumber('2.3e500');
    var b = math.clone(a);
    assert.deepEqual(a, b);
  });

  it('should clone a string', function() {
    var a = 'hello world';
    var b = math.clone(a);
    a = 'bye!';
    assert.strictEqual(a, 'bye!');
    assert.strictEqual(b, 'hello world');
  });

  it('should clone a complex number', function() {
    var a = math.complex(2, 3);
    var b = math.clone(a);
    assert.notEqual(a, b);
    a.re = 5;
    assert.strictEqual(a.toString(), '5 + 3i');
    assert.strictEqual(b.toString(), '2 + 3i');
  });

  it('should clone a unit', function() {
    var a = math.unit('5mm');
    var b = math.clone(a);
    a.value = 10;
    assert.equal(a.toString(), '10 m');
    assert.equal(b.toString(), '5 mm');
  });

  it('should clone a fraction', function() {
    var a = math.fraction(2,3);
    var b = math.clone(a);
    assert.deepEqual(a, b);
  });

  it('should clone an array', function() {
    var a = [1,2,[3,4]];
    var b = math.clone(a);
    a[2][1] = 5;
    assert.equal(b[2][1], 4);
  });

  it('should clone a matrix', function() {
    var a = math.matrix([[1, 2], [3, 4]]);
    var b = math.clone(a);
    a.valueOf()[0][0] = 5;
    assert.equal(b.valueOf()[0][0], 1);

    a = math.matrix([1, 2, new math.complex(2, 3), 4]);
    b = math.clone(a);
    a.valueOf()[2].re = 5;
    assert.equal(b.valueOf()[2].re, 2);
  });

  it('should LaTeX clone', function () {
    var expression = math.parse('clone(1)');
    assert.equal(expression.toTex(), '\\mathrm{clone}\\left(1\\right)');
  });

});
