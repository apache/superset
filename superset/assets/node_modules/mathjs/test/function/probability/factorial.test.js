var assert = require('assert'),
    approx = require('../../../tools/approx'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    factorial = math.factorial;

describe('factorial', function() {

  it('should calculate the factorial of a number', function() {
    assert.equal(factorial(0), 1);
    assert.equal(factorial(1), 1);
    assert.equal(factorial(2), 2);
    assert.equal(factorial(3), 6);
    assert.equal(factorial(4), 24);
    assert.equal(factorial(5), 120);
    assert.ok(!isFinite(factorial(Number.MAX_VALUE)));    // shouldn't stall
    assert.ok(!isFinite(factorial(Infinity)));
  });

  it('should calculate the factorial of a bignumber', function() {
    var bigmath = math.create({number: 'BigNumber', precision: 5});
    var bigfactorial = bigmath.factorial;
    var bignumber = bigmath.bignumber;

    assert.deepEqual(bigfactorial(bignumber(0)), bignumber(1));
    assert.deepEqual(bigfactorial(bignumber(Infinity)).toString(), 'Infinity');

    assert.deepEqual(bigfactorial(bignumber(11)), bignumber(39917000));
    assert.deepEqual(bigfactorial(bignumber(22)), bignumber(1.124e+21));

    bigmath.config({precision: 20});
    assert.deepEqual(bigfactorial(bignumber(5)), bignumber(120));
    assert.deepEqual(bigfactorial(bignumber(19)), bignumber(121645100408832000));
    assert.deepEqual(bigfactorial(bignumber(20)), bignumber(2432902008176640000));
    assert.deepEqual(bigfactorial(bignumber(21)), bignumber('51090942171709440000'));
    assert.deepEqual(bigfactorial(bignumber(25)), bignumber('1.5511210043330985984e+25'));
    assert.deepEqual(bigfactorial(bignumber(24)), bignumber('6.2044840173323943936e+23'));
    assert.deepEqual(bigfactorial(bignumber(22)), bignumber('1124000727777607680000'));

    bigmath.config({precision: 5});
    assert.deepEqual(bigfactorial(bignumber(11)), bignumber(39917000));
    assert.deepEqual(bigfactorial(bignumber(22)), bignumber(1.124e+21));
    assert.deepEqual(bigfactorial(bignumber(24)), bignumber(6.2045e+23));
    assert.deepEqual(bigfactorial(bignumber(21)), bignumber(5.1091e+19));
    assert.deepEqual(bigfactorial(bignumber(26)), bignumber(4.0329e+26));

    bigmath.config({precision: 20});
    assert.deepEqual(bigfactorial(bignumber(3000)), bignumber('4.1493596034378540856e+9130'));
  });

  it('should calculate the factorial of a boolean', function() {
    assert.equal(factorial(true), 1);
    assert.equal(factorial(false), 1);
  });

  it('should calculate the factorial of null', function() {
    assert.equal(factorial(null), 1);
  });

  it('should calculate the factorial of each element in a matrix', function() {
    assert.deepEqual(factorial(math.matrix([0,1,2,3,4,5])), math.matrix([1,1,2,6,24,120]));
  });

  it('should calculate the factorial of each element in an array', function() {
    assert.deepEqual(factorial([0,1,2,3,4,5]), [1,1,2,6,24,120]);
  });

  it('should calculate the factorial of a non-integer', function() {
    approx.equal(factorial(1.5), 1.32934038817913702047362561);
    approx.equal(factorial(7.5), 14034.40729348);
  });

  it('should throw error if called with negative number', function() {
    assert.throws(function() { factorial(-1); }, /Value must be non-negative/);
    assert.throws(function() { factorial(-1.5); }, /Value must be non-negative/);

    assert.throws(function() { factorial(math.bignumber(-1)); }, /Value must be non-negative/);
    assert.throws(function() { factorial(math.bignumber(-1.5)); }, /Value must be non-negative/);
    assert.throws(function() { factorial(math.bignumber(-Infinity)); }, /Value must be non-negative/);
  });

  it('should throw an error if called with non-integer bignumber', function() {
    assert.throws(function() { factorial(math.bignumber(1.5)); });
  });

  it('should throw en error if called with invalid number of arguments', function() {
    assert.throws(function() { factorial(); });
    assert.throws(function() { factorial(1,3); });
  });

  it('should throw en error if called with invalid type of argument', function() {
    assert.throws(function() { factorial(new Date()); });
    assert.throws(function() { factorial('a string'); });
  });

  it('should LaTeX factorial', function () {
    var expression = math.parse('factorial(6)');
    assert.equal(expression.toTex(), '\\left(6\\right)!');
  });

});
