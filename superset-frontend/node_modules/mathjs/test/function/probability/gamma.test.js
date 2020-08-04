var assert = require('assert'),
    approx = require('../../../tools/approx'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    bigUtil = require('../../../lib/utils/index').bignumber,
    bignumber = math.bignumber,
    gamma = math.gamma;

describe('gamma', function () {

  it('should calculate the gamma of an integer number', function () {
    assert.equal(gamma(1), 1);
    assert.equal(gamma(2), 1);
    assert.equal(gamma(3), 2);
    assert.equal(gamma(4), 6);
    assert.equal(gamma(5), 24);
    assert.equal(gamma(6), 120);
    assert.equal(gamma(Infinity), Infinity);    // shouldn't stall
  });

  it('should calculate the gamma of a nonpositive integer', function () {
    assert.equal(gamma(0), Infinity);
    assert.equal(gamma(-1), Infinity);
    assert.equal(gamma(-2), Infinity);
    assert.equal(gamma(-100000), Infinity);
    assert.ok(isNaN(gamma(-Infinity)));
  });

  it('should calculate the gamma of a rational number', function () {
    approx.equal(gamma(0.125), 7.5339415987976119046992);
    approx.equal(gamma(0.25), 3.625609908221908311930685);
    approx.equal(gamma(0.5), 1.77245385090551602729816748);
    approx.equal(gamma(1.5), 0.88622692545275801364908374);
    approx.equal(gamma(2.5), 1.32934038817913702047362561);
    approx.equal(gamma(3.5), 3.32335097044784255118406403);
    approx.equal(gamma(30.5), 4.8226969334909086010917483e+31);
    approx.equal(gamma(144.9), 3.37554680943478639050191e+249);

    approx.equal(gamma(-0.5), -3.54490770181103205459633);
    approx.equal(gamma(-1.5), 2.3632718012073547030642233);
    approx.equal(gamma(-2.5), -0.945308720482941881225689);
    approx.equal(gamma(-144.9), -2.078523735791760166777e-251);
  });

  it('should calculate the gamma of an irrational number', function () {
    approx.equal(gamma(Math.SQRT2), 0.8865814287192591250809176); 
    approx.equal(gamma(Math.PI), 2.2880377953400324179595889);
    approx.equal(gamma(Math.E), 1.56746825577405307486334);

    approx.equal(gamma(-Math.SQRT2), 2.599459907524570073533756846);
    approx.equal(gamma(-Math.PI), 1.01569714446021834110892259347);
    approx.equal(gamma(-Math.E), -0.952681729748073099220537210195);
  });

  it('should calculate the gamma of an integer bignumber', function () {
    assert.deepEqual(gamma(bignumber(1)), bignumber(1));
    assert.deepEqual(gamma(bignumber(2)), bignumber(1));
    assert.deepEqual(gamma(bignumber(3)), bignumber(2));
    assert.deepEqual(gamma(bignumber(4)), bignumber(6));
    assert.deepEqual(gamma(bignumber(5)), bignumber(24));
    assert.deepEqual(gamma(bignumber(6)), bignumber(120));
    assert.deepEqual(gamma(bignumber(31)), bignumber('265252859812191058636308480000000'));
    assert.deepEqual(gamma(bignumber(Infinity)).toString(), 'Infinity');
  });

  it('should calculate the gamma of a nonpositive integer bignumber', function () {
    assert.deepEqual(gamma(bignumber(0)).toString(), 'Infinity');
    assert.deepEqual(gamma(bignumber(-1)).toString(), 'Infinity');
    assert.deepEqual(gamma(bignumber(-2)).toString(), 'Infinity');
    assert.ok(gamma(bignumber(-Infinity)).isNaN());
  });
/*
  it('should calculate the gamma of a rational bignumber', function () {
    assert.deepEqual(gamma(bignumber(0.125)), bignumber('7.5339415987976'));
    assert.deepEqual(gamma(bignumber(0.25)), bignumber('3.62560990822191'));
    assert.deepEqual(gamma(bignumber(0.5)), bignumber('1.77245385090552'));
    assert.deepEqual(gamma(bignumber(1.5)), bignumber('0.886226925452758'));
    assert.deepEqual(gamma(bignumber(2.5)), bignumber('1.32934038817914'));

    var bigmath = math.create({ precision: 15 });
    assert.deepEqual(bigmath.gamma(bignumber(30.5)), '4.82269693349091e+31');

    bigmath.config({ precision: 13 });
    assert.deepEqual(bigmath.gamma(bignumber(-1.5)), bigmath.bignumber('2.363271801207'));
    assert.deepEqual(gamma(bignumber(-2.5)), bignumber('-0.9453087205'));
  });

  it('should calculate the gamma of an irrational bignumber', function () {
    assert.deepEqual(gamma(bigUtil.phi(math.precision).neg()), bignumber('2.3258497469'));
    assert.deepEqual(gamma(bigUtil.phi(math.precision)), bignumber('0.895673151705288'));

    assert.deepEqual(gamma(bigUtil.pi(20)), bignumber('2.28803779534003'));
    assert.deepEqual(gamma(bigUtil.e(math.precision)), bignumber('1.56746825577405'));

    var bigmath = math.create({ number: 'BigNumber' });
    assert.deepEqual(gamma(bigmath.SQRT2), bignumber('0.886581428719259'));
    assert.deepEqual(gamma(bigmath.SQRT2.neg()), bignumber('2.59945990753'));
  });
*/
  it('should calculate the gamma of an imaginary unit', function () {
    approx.deepEqual(gamma(math.i), math.complex(-0.154949828301810685124955130,
                                                 -0.498015668118356042713691117));
  });

  it('should calculate the gamma of a complex number', function () {
    approx.deepEqual(gamma(math.complex(1, 1)), math.complex( 0.498015668118356,
                                                             -0.154949828301810));
    approx.deepEqual(gamma(math.complex(1, -1)), math.complex(0.498015668118356,
                                                              0.154949828301810));
    approx.deepEqual(gamma(math.complex(-1, 1)), math.complex(-0.17153291990827,
                                                               0.32648274821008));
    approx.deepEqual(gamma(math.complex(-1, -1)), math.complex(-0.1715329199082,
                                                               -0.3264827482100));
    approx.deepEqual(gamma(math.complex(0.5, 0.5)), math.complex( 0.81816399954,
                                                                 -0.76331382871));
    approx.deepEqual(gamma(math.complex(0.5, -0.5)), math.complex(0.81816399954,
                                                                  0.76331382871));
    approx.deepEqual(gamma(math.complex(-0.5, 0.5)), math.complex(-1.5814778282,
                                                                  -0.0548501708));
    approx.deepEqual(gamma(math.complex(-0.5, -0.5)), math.complex(-1.581477828,
                                                                    0.054850170));
    approx.deepEqual(gamma(math.complex(5, 3)), math.complex( 0.016041882741652,
                                                             -9.433293289755986));
    approx.deepEqual(gamma(math.complex(5, -3)), math.complex(0.016041882741652,
                                                              9.433293289755986));
    approx.deepEqual(math.multiply(gamma(math.complex(-5, 3)), 1e6),
                     math.complex(7.896487481239, 4.756173836597));
    approx.deepEqual(math.multiply(gamma(math.complex(-5, -3)), 1e6),
                     math.complex(7.8964874812, -4.7561738365));
  });

  it('should calculate the gamma of a boolean', function () {
    assert.equal(gamma(true), 1);
    assert.equal(gamma(false), Infinity);
  });

  it('should calculate the gamma of null', function () {
    assert.equal(gamma(null), Infinity);
  });

  it('should calculate the gamma of each element in a matrix', function () {
    assert.deepEqual(gamma(math.matrix([0,1,2,3,4,5])), math.matrix([Infinity,1,1,2,6,24]));
  });

  it('should calculate the gamma of each element in an array', function () {
    assert.deepEqual(gamma([0,1,2,3,4,5]), [Infinity,1,1,2,6,24]);
  });

  it('should throw en error if called with invalid number of arguments', function() {
    assert.throws(function() { gamma(); });
    assert.throws(function() { gamma(1,3); });
  });

  it('should throw en error if called with invalid type of argument', function() {
    assert.throws(function() { gamma(new Date()); });
    assert.throws(function() { gamma('a string'); });
  });

  it('should LaTeX gamma', function () {
    var expression = math.parse('gamma(2.5)');
    assert.equal(expression.toTex(), '\\Gamma\\left(2.5\\right)');
  });

});
