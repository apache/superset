var assert = require('assert');
var BigNumber = require('decimal.js');
var formatter = require('../../../lib/utils/bignumber/formatter');

describe('format', function () {

  describe('format', function () {

    var B = null;

    before (function () {
      B = BigNumber.clone({precision: 20});  // ensure the precision is 20 digits
    });

    it ('should format special values Infinity, NaN', function () {
      assert.equal(formatter.format(new BigNumber(Infinity)), 'Infinity');
      assert.equal(formatter.format(new BigNumber(-Infinity)), '-Infinity');
      assert.equal(formatter.format(new BigNumber(NaN)), 'NaN');
    });

    it('auto notation', function () {
      assert.equal(formatter.format(new B(2).dividedBy(7)), '0.28571428571428571429');
      assert.equal(formatter.format(new B(0.10400)), '0.104');
      assert.equal(formatter.format(new B(1000)), '1000');

      assert.equal(formatter.format(new B(0)), '0');

      assert.equal(formatter.format(new B(2.4e-7)), '2.4e-7');
      assert.equal(formatter.format(new B(2.4e-6)), '2.4e-6');
      assert.equal(formatter.format(new B(2.4e-5)), '2.4e-5');
      assert.equal(formatter.format(new B(2.4e-4)), '2.4e-4');
      assert.equal(formatter.format(new B(2.3e-3)), '0.0023');
      assert.equal(formatter.format(new B(2.3456e-3)), '0.0023456');
      assert.equal(formatter.format(new B(2.3e-2)), '0.023');
      assert.equal(formatter.format(new B(2.3e-1)), '0.23');
      assert.equal(formatter.format(new B(2.3)), '2.3');
      assert.equal(formatter.format(new B(2.3e+1)), '23');
      assert.equal(formatter.format(new B(2.3e+2)), '230');
      assert.equal(formatter.format(new B(2.3e+3)), '2300');
      assert.equal(formatter.format(new B(2.3e+4)), '23000');
      assert.equal(formatter.format(new B(2.3e+5)), '2.3e+5');
      assert.equal(formatter.format(new B(2.3e+6)), '2.3e+6');

      assert.equal(formatter.format(new B(1.000000012)), '1.000000012');
      assert.equal(formatter.format(new B(1000000012)), '1.000000012e+9');

      assert.equal(formatter.format(new B(1234567)), '1.234567e+6');
      assert.equal(formatter.format(new B(123456789123456)), '1.23456789123456e+14');
      assert.equal(formatter.format(new B(123456789123456e-14)), '1.23456789123456');
      assert.equal(formatter.format(new B('123456789123456789')), '1.23456789123456789e+17');
      assert.equal(formatter.format(new B('123456789123456789123456789')), '1.23456789123456789123456789e+26');

      assert.equal(formatter.format(new B(0.1111e+6)), '1.111e+5');
      assert.equal(formatter.format(new B(0.3333e+6)), '3.333e+5');
      assert.equal(formatter.format(new B(0.6666e+6)), '6.666e+5');
      assert.equal(formatter.format(new B(0.9999e+6)), '9.999e+5');
      assert.equal(formatter.format(new B(1.111e+6)), '1.111e+6');
    });

    it('auto notation with precision as second parameter', function() {
      assert.deepEqual(formatter.format(new B('1.23456'), 3), '1.23');
      assert.deepEqual(formatter.format(new B('12345678'), 4), '1.235e+7');

      assert.equal(formatter.format(new B(1).dividedBy(3)), '0.33333333333333333333');
      assert.equal(formatter.format(new B(1).dividedBy(3), 5), '0.33333');
      assert.equal(formatter.format(new B(1).dividedBy(3), 3), '0.333');
      assert.equal(formatter.format(new B(2).dividedBy(3), 3), '0.667');
    });

    describe('should apply options', function () {

      it('auto notation with precision', function () {
        assert.equal(formatter.format(new B(1).div(3)), '0.33333333333333333333');
        assert.equal(formatter.format(new B(1).div(3), {precision: 3}), '0.333');
        assert.equal(formatter.format(new B(1).div(3), {precision: 4}), '0.3333');
        assert.equal(formatter.format(new B(1).div(3), {precision: 5}), '0.33333');

        assert.equal(formatter.format(new B(1000.000), {precision: 5}), '1000');
        assert.equal(formatter.format(new B(1000.0010), {precision: 5}), '1000'); // rounded off at 5 digits
        assert.equal(formatter.format(new B(1234), {precision: 3}), '1230');
        assert.equal(formatter.format(new B(123.4), {precision: 6}), '123.4');
        assert.equal(formatter.format(new B(0.001234), {precision: 3}), '0.00123');

        assert.equal(formatter.format(new B(1234567), {precision: 4}), '1.235e+6');
        assert.equal(formatter.format(new B(1234567), {precision: 2}), '1.2e+6');
        assert.equal(formatter.format(new B(123e-6), {precision: 2}), '1.2e-4');
        assert.equal(formatter.format(new B(123e-6), {precision: 8}), '1.23e-4'); // should remove trailing zeros
        assert.equal(formatter.format(new B(3e+6), {precision: 8}), '3e+6');        // should remove trailing zeros
        assert.equal(formatter.format(new B(1234), {precision: 2}), '1200');

        // overflow the maximum precision of 20
        assert.equal(formatter.format(new B(2.3), {precision: 30}), '2.3');
      });

      it('auto notation with custom lower and upper bound', function () {
        var options = {
          exponential: {
            lower: 1e-6,
            upper: 1e+9
          }
        };
        assert.equal(formatter.format(new B(0), options), '0');
        assert.equal(formatter.format(new B(1234567), options), '1234567');
        assert.equal(formatter.format(new B(1e+9), options), '1e+9');
        assert.equal(formatter.format(new B(1e+9-1), options), '999999999');
        assert.equal(formatter.format(new B(1e-6), options), '0.000001');
        assert.equal(formatter.format(new B(0.999e-6), options), '9.99e-7');
        assert.equal(formatter.format(new B(123456789123), options), '1.23456789123e+11');
      });

    });

    it('should format bignumbers with a custom formatting function', function() {
      function asCurrency (value) {
        return '$' + value.toFixed(2);
      }

      assert.equal(formatter.format(new BigNumber(12.4264), asCurrency), '$12.43');
      assert.equal(formatter.format(new BigNumber(0.1), asCurrency), '$0.10');
      assert.equal(formatter.format(new BigNumber(1.2e+6), asCurrency), '$1200000.00');
    });

    it('should format bignumbers in exponential notation', function() {
      var options = {
        notation: 'exponential'
      };
      assert.deepEqual(formatter.format(new B('1.23456'), options), '1.23456e+0');
      assert.deepEqual(formatter.format(new B('12345678'), options), '1.2345678e+7');
      assert.deepEqual(formatter.format(new B('2.3e+30'), options), '2.3e+30');
      assert.deepEqual(formatter.format(new B('0.23e+30'), options), '2.3e+29');
      assert.deepEqual(formatter.format(new B('2.3e-30'), options), '2.3e-30');
      assert.deepEqual(formatter.format(new B('0.23e-30'), options), '2.3e-31');
    });

    it('should format bignumbers in exponential notation with precision', function() {
      var options = {
        notation: 'exponential',
        precision: 18
      };
      assert.deepEqual(formatter.format(new B(1).div(3), options), '3.33333333333333333e-1');
    });

    it('should format bignumbers with custom precision, lower, and upper bound', function() {
      var Big = BigNumber.clone({precision: 100});

      var options = {
        notation: 'auto',
        precision : 50,
        exponential: {
          lower: 1e-50,
          upper: 1e+50
        }
      };

      assert.deepEqual(formatter.format(new Big(5).div(3), options), '1.6666666666666666666666666666666666666666666666667');
      assert.deepEqual(formatter.format(new Big(5e+40).div(3), options), '16666666666666666666666666666666666666666.666666667');
      assert.deepEqual(formatter.format(new Big(5e-40).div(3), options),
          '0.00000000000000000000000000000000000000016666666666666666666666666666666666666666666666667');
      assert.deepEqual(formatter.format(new Big(5e+60).div(3), options), '1.6666666666666666666666666666666666666666666666667e+60');
      assert.deepEqual(formatter.format(new Big(5e-60).div(3), options), '1.6666666666666666666666666666666666666666666666667e-60');
      assert.deepEqual(formatter.format(new Big(5e-80).div(3), options), '1.6666666666666666666666666666666666666666666666667e-80');
    });

    it('auto notation with custom lower bound', function () {
      var options = {
        exponential: {
          lower: 1e-6
        }
      };
      assert.equal(formatter.format(new BigNumber(0), options), '0');
      assert.equal(formatter.format(new BigNumber(1e-5), options), '0.00001');
      assert.equal(formatter.format(new BigNumber(1e-6), options), '0.000001');
      assert.equal(formatter.format(new BigNumber(0.999e-6), options), '9.99e-7');
      assert.equal(formatter.format(new BigNumber(1e-7), options), '1e-7');
    });

    it('auto notation with custom upper bound', function () {
      var options = {
        exponential: {
          upper: 1e+9
        }
      };
      assert.equal(formatter.format(new BigNumber(1e+9), options), '1e+9');
      assert.equal(formatter.format(new BigNumber(1e+9-1), options), '999999999');
    });

    it('should format bignumbers in fixed notation', function() {
      var options = {
        notation: 'fixed'
      };

      assert.deepEqual(formatter.format(new BigNumber('1.23456'), options), '1');
      assert.deepEqual(formatter.format(new BigNumber('1.7'), options), '2');
      assert.deepEqual(formatter.format(new BigNumber('12345678'), options), '12345678');
      assert.deepEqual(formatter.format(new BigNumber('12e18'), options), '12000000000000000000');
      assert.deepEqual(formatter.format(new BigNumber('12e30'), options), '12000000000000000000000000000000');
    });


    it('should format bignumbers in fixed notation with precision', function() {
      options = {
        notation: 'fixed',
        precision: 2
      };
      assert.deepEqual(formatter.format(new BigNumber('1.23456'), options), '1.23');
      assert.deepEqual(formatter.format(new BigNumber('12345678'), options), '12345678.00');
      assert.deepEqual(formatter.format(new BigNumber('12e18'), options), '12000000000000000000.00');
      assert.deepEqual(formatter.format(new BigNumber('12e30'), options), '12000000000000000000000000000000.00');
    });

    it('should throw an error on unknown notation', function () {
      assert.throws(function () {
        formatter.format(new BigNumber(123), {notation: 'non existing'})
      });
    });

  });

  it('should format a bignumber using toFixed', function() {
    var Big = BigNumber.clone({precision: 100});

    assert.equal(formatter.toFixed(new Big(2.34)), '2');
    assert.equal(formatter.toFixed(new Big(2.34), 1), '2.3');
    assert.equal(formatter.toFixed(new Big(2), 20), '2.00000000000000000000');
    assert.equal(formatter.toFixed(new Big(2), 21), '2.000000000000000000000');
    assert.equal(formatter.toFixed(new Big(2), 22), '2.0000000000000000000000');
    assert.equal(formatter.toFixed(new Big(2), 30), '2.000000000000000000000000000000');
  });

  it('should format a bignumber using toExponential', function() {
    var Big = BigNumber.clone({precision: 100});

    assert.equal(formatter.toExponential(new Big(2.34)), '2.34e+0');
    assert.equal(formatter.toExponential(new Big(2.34e+3)), '2.34e+3');
    assert.equal(formatter.toExponential(new Big(2.34e-3)), '2.34e-3');
    assert.equal(formatter.toExponential(new Big(2.34e+3), 2), '2.3e+3');
    assert.equal(formatter.toExponential(new Big(2e+3), 20), '2.0000000000000000000e+3');
    assert.equal(formatter.toExponential(new Big(2e+3), 21), '2.00000000000000000000e+3');
    assert.equal(formatter.toExponential(new Big(2e+3), 22), '2.000000000000000000000e+3');
    assert.equal(formatter.toExponential(new Big(2e+3), 30), '2.00000000000000000000000000000e+3');
    assert.equal(formatter.toExponential(new Big('2e+300'), 30), '2.00000000000000000000000000000e+300');
    assert.equal(formatter.toExponential(new Big('2e-300'), 30), '2.00000000000000000000000000000e-300');
  });

});
