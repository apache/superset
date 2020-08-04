var assert = require('assert'),
    approx = require('../../../tools/approx'),
    math = require('../../../index'),
    bignumber = math.bignumber,
    quantileSeq = math.quantileSeq;

describe('quantileSeq', function() {

  it('should return the quantileSeq from an array with number probability', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    assert.equal(quantileSeq(lst, 0), 1.3);
    assert.equal(quantileSeq(lst, 0.1), 1.75);
    assert.equal(quantileSeq(lst, 0.2), 2.2);
    assert.equal(quantileSeq(lst, 0.25), 2.325);
    assert.equal(quantileSeq(lst, 0.25, false), 2.325);
    assert.equal(quantileSeq(lst, 0.3), 2.45);
    assert.equal(quantileSeq(lst, 0.4), 2.7);
    approx.equal(quantileSeq(lst, 0.5), 2.9);
    assert.equal(quantileSeq(lst, 0.6), 3.1);
    assert.equal(quantileSeq(lst, 0.7), 3.2);
    approx.equal(quantileSeq(lst, 0.75), 3.25);
    assert.equal(quantileSeq(lst, 0.8), 3.3);
    assert.equal(quantileSeq(lst, 0.9), 3.5);
    assert.equal(quantileSeq(lst, 1), 3.7);
  });

  it('should return the quantileSeq from an ascending array with number probability', function() {
    var lst = [1.3, 2.2, 2.7, 3.1, 3.3, 3.7];
    assert.equal(quantileSeq(lst, 0, true), 1.3);
    assert.equal(quantileSeq(lst, 0.1, true), 1.75);
    assert.equal(quantileSeq(lst, 0.2, true), 2.2);
    assert.equal(quantileSeq(lst, 0.25, true), 2.325);
    assert.equal(quantileSeq(lst, 0.3, true), 2.45);
    assert.equal(quantileSeq(lst, 0.4, true), 2.7);
    approx.equal(quantileSeq(lst, 0.5, true), 2.9);
    assert.equal(quantileSeq(lst, 0.6, true), 3.1);
    assert.equal(quantileSeq(lst, 0.7, true), 3.2);
    approx.equal(quantileSeq(lst, 0.75, true), 3.25);
    assert.equal(quantileSeq(lst, 0.8, true), 3.3);
    assert.equal(quantileSeq(lst, 0.9, true), 3.5);
    assert.equal(quantileSeq(lst, 1, true), 3.7);
  });

  it('should return the quantileSeq from an array with BigNumber probability', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    assert.equal(quantileSeq(lst, bignumber(0)), 1.3);
    assert.equal(quantileSeq(lst, bignumber(0.1)), 1.75);
    assert.equal(quantileSeq(lst, bignumber(0.2)), 2.2);
    assert.equal(quantileSeq(lst, bignumber(0.25)), 2.325);
    assert.equal(quantileSeq(lst, bignumber(0.3)), 2.45);
    assert.equal(quantileSeq(lst, bignumber(0.4)), 2.7);
    assert.equal(quantileSeq(lst, bignumber(0.5)), 2.9);
    assert.equal(quantileSeq(lst, bignumber(0.6)), 3.1);
    assert.equal(quantileSeq(lst, bignumber(0.7)), 3.2);
    assert.equal(quantileSeq(lst, bignumber(0.75)), 3.25);
    assert.equal(quantileSeq(lst, bignumber(0.8)), 3.3);
    assert.equal(quantileSeq(lst, bignumber(0.9)), 3.5);
    assert.equal(quantileSeq(lst, bignumber(1)), 3.7);
  });

  // FIXME: should return the quantileSeq of an array of bignumbers with number probability
  it.skip('should return the quantileSeq of an array of bignumbers with number probability', function() {
    approx.equal(quantileSeq([bignumber(0.5377),bignumber(1.8339),bignumber(-2.2588),bignumber(0.8622),
                              bignumber(0.3188),bignumber(-1.3077),bignumber(-0.4336),bignumber(0.3426),
                              bignumber(3.5784),bignumber(2.7694)],0.3),
                              0.09308);
  });

  it('should return the quantileSeq of an array of bignumbers with BigNumber probability', function() {
    assert.deepEqual(quantileSeq([bignumber(0.5377),bignumber(1.8339),bignumber(-2.2588),bignumber(0.8622),
                                  bignumber(0.3188),bignumber(-1.3077),bignumber(-0.4336),bignumber(0.3426),
                                  bignumber(3.5784),bignumber(2.7694)],bignumber(0.3)),
                                  bignumber(0.09308));
  });

  it('should return the quantileSeq of units', function() {
    assert.deepEqual(quantileSeq([math.unit('5mm'), math.unit('15mm'), math.unit('10mm')], 0.5), math.unit('10mm'));
  });

  it('should return the quantileSeq from an 1d matrix', function() {
    assert.equal(quantileSeq(math.matrix([2,4,6,8,10,12,14]), 0.25), 5);
  });

  it('should return the quantileSeq from a 2d array', function() {
    approx.equal(quantileSeq([
      [3.7, 2.7, 3.3],
      [1.3, 2.2, 3.1]
    ], 0.75), 3.25);
  });

  it('should return the quantileSeq from an ascending 2d array', function() {
    approx.equal(quantileSeq([
      [1.3, 2.2, 2.7],
      [3.1, 3.3, 3.7]
    ], 0.75, true), 3.25);
  });

  it('should return the quantileSeq from a 2d matrix', function() {
    approx.equal(quantileSeq(math.matrix([
      [3.7, 2.7, 3.3],
      [1.3, 2.2, 3.1]
    ]), 0.75), 3.25);
  });

  it('should return the quantileSeq from an ascending 2d matrix', function() {
    approx.equal(quantileSeq(math.matrix([
      [1.3, 2.2, 2.7],
      [3.1, 3.3, 3.7]
    ]), 0.75, true), 3.25);
  });

  it('should return list quantiles for list of number probabilities', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    approx.deepEqual(quantileSeq(lst, [0.25, 0.5, 0.75]), [2.325, 2.9, 3.25]);
    approx.deepEqual(quantileSeq(lst, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
                     [1.75, 2.2, 2.45, 2.7, 2.9, 3.1, 3.2, 3.3, 3.5]);
  });

  it('should return list quantiles for list of BigNumber probabilities', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    assert.deepEqual(quantileSeq(lst, [bignumber(0.25), bignumber(0.5), bignumber(0.75)]),
                     [bignumber(2.325), bignumber(2.9), bignumber(3.25)]);
    assert.equal(quantileSeq(lst, [bignumber(0.1), bignumber(0.2), bignumber(0.3), bignumber(0.4),
                                   bignumber(0.5), bignumber(0.6), bignumber(0.7), bignumber(0.8),
                                   bignumber(0.9)]).toString(), '1.75,2.2,2.45,2.7,2.9,3.1,3.2,3.3,3.5');
  });

  it('should return list quantiles for list of number and BigNumber probabilities', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    approx.deepEqual(quantileSeq(lst, [0.25, bignumber(0.5), 0.75]), [2.325, 2.9, 3.25]);
    approx.deepEqual(quantileSeq(lst, [0.1, 0.2, bignumber(0.3), 0.4, 0.5, 0.6, 0.7, bignumber(0.8), 0.9]),
                     [1.75, 2.2, 2.45, 2.7, 2.9, 3.1, 3.2, 3.3, 3.5]);
  });

  it('should return the evenly number spaced quantiles of an array', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    approx.deepEqual(quantileSeq(lst, 3), [2.325, 2.9, 3.25]);
    approx.deepEqual(quantileSeq(lst, 9), [1.75, 2.2, 2.45, 2.7, 2.9, 3.1, 3.2, 3.3, 3.5]);
  });

  it('should return the evenly BigNumber spaced quantiles of an array', function() {
    var lst = [3.7, 2.7, 3.3, 1.3, 2.2, 3.1];
    assert.deepEqual(quantileSeq(lst, bignumber(3)), [bignumber(2.325), bignumber(2.9), bignumber(3.25)]);
    assert.equal(quantileSeq(lst, bignumber(9)).toString(), "1.75,2.2,2.45,2.7,2.9,3.1,3.2,3.3,3.5");
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() {quantileSeq()}, SyntaxError);
    assert.throws(function() {quantileSeq(2)}, SyntaxError);
    assert.throws(function() {quantileSeq([], 2, 3, 1)}, SyntaxError);
  });

  it('should throw an error if called with unsupported type of arguments', function() {
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], 0.25, 10)}, math.error.UnsupportedTypeError);
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], [0.25, 2])}, math.error.UnsuppoError);
    assert.throws(function () {quantileSeq('A', 'C', 'B')}, math.error.UnsupportedTypeError);
    assert.throws(function () {quantileSeq(true, false, true)}, math.error.UnsupportedTypeError);
    assert.throws(function () {quantileSeq(0, 'B')}, math.error.UnsupportedTypeError);
    assert.throws(function () {quantileSeq(math.complex(2,3), math.complex(-1,2))}, TypeError);
  });

  it('should throw error for bad probabilities and splits', function() {
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], [0.23, 2, 0.2])}, Error);
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], [0.23, bignumber(2), 0.2])}, Error);
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], -2)}, Error);
    assert.throws(function () {quantileSeq([2,4,6,8,10,12,14], bignumber(-2))}, Error);
  });

  it('should throw an error if called with an empty array', function() {
    assert.throws(function() {quantileSeq([])});
  });

  it('should not mutate the input', function () {
    var a = [3,2,1];
    quantileSeq(a, 0.2);
    quantileSeq(a, 2);
    quantileSeq(a, [0.1, 0.3]);
    assert.deepEqual(a,[3,2,1]);
  });

  /*
  it('should LaTeX quantileSeq', function () {
    var expression = math.parse('quantileSeq(1,2,3,4,0.3)');
    assert.equal(expression.toTex(), '\\mathrm{quantile}\\left(1,2,3,4,0.3\\right)');
  });
  */
});
