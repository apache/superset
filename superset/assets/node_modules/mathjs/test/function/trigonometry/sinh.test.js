var assert = require('assert');
var error = require('../../../lib/error/index');
var math = require('../../../index');
var approx = require('../../../tools/approx');
var complex = math.complex;
var matrix = math.matrix;
var unit = math.unit;
var sinh = math.sinh;
var bigmath = math.create({number: 'BigNumber', precision: 20});

var EPSILON = 1e-14;


describe('sinh', function() {
  it('should return the sinh of a boolean', function () {
    assert.equal(sinh(true), 1.1752011936438014);
    assert.equal(sinh(false), 0);
  });

  it('should return the sinh of a null', function () {
    assert.equal(sinh(null), 0);
  });

  it('should return the sinh of a number', function() {
    approx.equal(sinh(-2), -3.62686040784701876766821398280126170488634201232113572130, EPSILON);
    approx.equal(sinh(-0.5), -0.52109530549374736162242562641149155910592898261148052794, EPSILON);
    approx.equal(sinh(0), 0, EPSILON);
    approx.equal(sinh(0.3), 0.304520293447142618958435267005095229098024232680179727377, EPSILON);
    approx.equal(sinh(0.5), 0.521095305493747361622425626411491559105928982611480527946, EPSILON);
    approx.equal(sinh(0.8), 0.888105982187623006574717573189756980559709596888150052610, EPSILON);
    approx.equal(sinh(1), 1.175201193643801456882381850595600815155717981334095870229, EPSILON);
    approx.equal(sinh(2), 3.626860407847018767668213982801261704886342012321135721309, EPSILON);
  });

  if (!/v0\.10|v0\.12/.test(process.version)) {
    // skip this test on node v0.10 and v0.12, which have a numerical issue

    it('should return the sinh of very small numbers (avoid returning zero)', function() {
      // If sinh returns 0, that is bad, so we are using assert.equal, not approx.equal
      assert.equal(sinh(-1e-10), -1e-10);
      assert.equal(sinh(1e-50), 1e-50);
    });
  }

  it('should return the sinh of a bignumber', function() {
    var sinhBig = bigmath.sinh;
    var Big = bigmath.bignumber;

    var arg1 = Big(-Infinity);
    var arg2 = Big(-1);
    var arg7 = Big(Infinity);
    assert.deepEqual(sinhBig(arg1).toString(), '-Infinity');
    assert.deepEqual(sinhBig(arg2), Big('-1.1752011936438014569'));
    assert.deepEqual(sinhBig(Big(-1e-10)), Big(-1e-10));
    assert.deepEqual(sinhBig(Big(0)), Big(0));
    assert.deepEqual(sinhBig(Big(1)), Big('1.1752011936438014569'));
    assert.deepEqual(sinhBig(bigmath.pi).toString(), '11.548739357257748378');
    assert.deepEqual(sinhBig(arg7).toString(), 'Infinity');

    // Ensure args were not changed
    assert.deepEqual(arg1.toString(), '-Infinity');
    assert.deepEqual(arg2, Big(-1));
    assert.deepEqual(arg7.toString(), 'Infinity');

    bigmath.config({precision: 50});
    assert.deepEqual(sinhBig(Big(1e-50)), Big(1e-50));
  });

  it('should return the sinh of a complex number', function() {
    approx.deepEqual(sinh(complex('1')), complex(1.1752011936438014, 0), EPSILON);
    approx.deepEqual(sinh(complex('i')), complex(0, 0.8414709848079), EPSILON);
    approx.deepEqual(sinh(complex('2 + i')), complex(1.9596010414216, 3.1657785132162), EPSILON);
  });

  it('should return the sinh of an angle', function() {
    approx.equal(sinh(unit('90deg')), 2.3012989023073, EPSILON);
    approx.equal(sinh(unit('-45deg')), -0.86867096148601, EPSILON);

    assert(math.type.isBigNumber(sinh(unit(math.bignumber(90), 'deg'))));
    approx.equal(sinh(unit(math.bignumber(90), 'deg')).toNumber(), 2.3012989023073, EPSILON);

    approx.deepEqual(sinh(unit(complex('2 + i'), 'rad')), complex(1.9596010414216, 3.1657785132162), EPSILON);
  });

  it('should throw an error if called with an invalid unit', function() {
    assert.throws(function () {sinh(unit('5 celsius'))});
  });

  it('should throw an error if called with a string', function() {
    assert.throws(function () {sinh('string')});
  });

  var sinh123 = [1.1752011936438014, 3.626860407847, 10.01787492741];

  it('should return the sinh of each element of an array', function() {
    approx.deepEqual(sinh([1,2,3]), sinh123, EPSILON);
  });

  it('should return the sinh of each element of a matrix', function() {
    approx.deepEqual(sinh(matrix([1,2,3])), matrix(sinh123), EPSILON);
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {sinh()}, /TypeError: Too few arguments/);
    assert.throws(function () {sinh(1, 2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX sinh', function () {
    var expression = math.parse('sinh(1)');
    assert.equal(expression.toTex(), '\\sinh\\left(1\\right)');
  });
});
