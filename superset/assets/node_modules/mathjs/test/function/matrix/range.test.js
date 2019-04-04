var assert = require('assert'),
    approx = require('../../../tools/approx'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    range = math.range,
    matrix = math.matrix,
    bignumber = math.bignumber;

describe('range', function() {

  it('should parse a valid string correctly', function() {
    assert.deepEqual(range('1:6'), matrix([1,2,3,4,5]));
    assert.deepEqual(range('0:2:10'), matrix([0,2,4,6,8]));
    assert.deepEqual(range('5:-1:0'), matrix([5,4,3,2,1]));
    assert.deepEqual(range('2:-2:-3'), matrix([2,0,-2]));
  });

  it('should throw an error in case of invalid string', function() {
    assert.throws(function () {range('1:2:6:4')}, /is no valid range/);
    assert.throws(function () {range('1')}, /is no valid range/);
    assert.throws(function () {range('1,3:4')}, /is no valid range/);
    assert.throws(function () {range('1:2,4')}, /is no valid range/);
    assert.throws(function () {range('1:a')}, /is no valid range/);
  });

  it('should create a range start:1:end if called with 2 numbers', function() {
    assert.deepEqual(range(3,6), matrix([3,4,5]));
    assert.deepEqual(range(1,6), matrix([1,2,3,4,5]));
    assert.deepEqual(range(1,6.1), matrix([1,2,3,4,5,6]));
    assert.deepEqual(range(1,5.9), matrix([1,2,3,4,5]));
    assert.deepEqual(range(6,1), matrix([]));
  });

  it('should create a range start:step:end if called with 3 numbers', function() {
    assert.deepEqual(range(0,10,2), matrix([0,2,4,6,8]));
    assert.deepEqual(range(5,0,-1), matrix([5,4,3,2,1]));
    assert.deepEqual(range(2,-4,-2), matrix([2,0,-2]));
  });

  it('should create an empty range when step==0', function() {
    assert.deepEqual(range(0,10,0), matrix([]));
    assert.deepEqual(range(0,10,0, true), matrix([]));
  });

  it('should output an array when setting matrix==="array"', function() {
    var math2 = math.create({
      matrix: 'Array'
    });

    assert.deepEqual(math2.range(0,10,2), [0,2,4,6,8]);
    assert.deepEqual(math2.range(5,0,-1), [5,4,3,2,1]);
  });

  it('should create a range with bignumbers', function() {
    assert.deepEqual(range(bignumber(1), bignumber(3)), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(bignumber(3), bignumber(1), bignumber(-1)), matrix([bignumber(3),bignumber(2)]));
  });

  it('should create an empty range from bignumbers when step==0', function() {
    assert.deepEqual(range(bignumber(0),bignumber(10),bignumber(0)), matrix([]));
    assert.deepEqual(range(bignumber(0),bignumber(10),bignumber(0), true), matrix([]));
  });

  it('should create a range with mixed numbers and bignumbers', function() {
    assert.deepEqual(range(bignumber(1), 3), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(1, bignumber(3)), matrix([bignumber(1),bignumber(2)]));

    assert.deepEqual(range(1, bignumber(3), bignumber(1)), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(bignumber(1), 3, bignumber(1)), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(bignumber(1), bignumber(3), 1), matrix([bignumber(1),bignumber(2)]));

    assert.deepEqual(range(bignumber(1), 3, 1), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(1, bignumber(3), 1), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(range(1, 3, bignumber(1)), matrix([bignumber(1),bignumber(2)]));
  });

  it('should parse a range with bignumbers', function() {
    var bigmath = math.create({number: 'BigNumber'});
    var bignumber = bigmath.bignumber;
    assert.deepEqual(bigmath.range('1:3'), matrix([bignumber(1),bignumber(2)]));
    assert.deepEqual(bigmath.range('3:-1:0'), matrix([bignumber(3),bignumber(2),bignumber(1)]));
  });

  it('should throw an error when parsing a an invalid string to a bignumber range', function() {
    var bigmath = math.create({number: 'BigNumber'});
    assert.throws(function () {bigmath.range('1:a')}, /is no valid range/);
  });

  describe ('option includeEnd', function () {
    it('should parse a string and include end', function () {
      assert.deepEqual(range('1:6', false), matrix([1,2,3,4,5]));
      assert.deepEqual(range('1:2:6', false), matrix([1,3,5]));
      assert.deepEqual(range('1:6', true), matrix([1,2,3,4,5,6]));
    });

    it('should create a range start:1:end and include end', function () {
      assert.deepEqual(range(3,6, false), matrix([3,4,5]));
      assert.deepEqual(range(3,6, true), matrix([3,4,5,6]));
    });

    it('should create a range start:step:end and include end', function () {
      assert.deepEqual(range(0,10,2, false), matrix([0,2,4,6,8]));
      assert.deepEqual(range(0,10,2, true), matrix([0,2,4,6,8,10]));
    });

    it('should create a range with bignumbers and include end', function() {
      assert.deepEqual(range(bignumber(1), bignumber(3), true), matrix([bignumber(1),bignumber(2),bignumber(3)]));
      assert.deepEqual(range(bignumber(3), bignumber(1), bignumber(-1), true), matrix([bignumber(3),bignumber(2),bignumber(1)]));
    });

    it('should throw an error in case of invalid type of include end', function () {
      assert.throws(function () {range(0,10,2, 0)}, /TypeError: Unexpected type of argument/);
      assert.throws(function () {range(0,10,2, 1)}, /TypeError: Unexpected type of argument/);
      assert.throws(function () {range(0,10,2, 'str')}, /TypeError: Unexpected type of argument/);
    });
  });

  it('should throw an error if called with an invalid string', function() {
    assert.throws(function () {range('invalid range')}, SyntaxError);
  });

  it('should throw an error if called with a unit', function() {
    assert.throws(function () {range(math.unit('5cm'))}, TypeError);
  });

  it('should throw an error if called with a complex number', function() {
    assert.throws(function () {range(math.complex(2,3))}, TypeError);
  });

  it('should throw an error if called with one invalid argument', function() {  
    assert.throws(function () {range(math.unit('5cm'), 2)}, TypeError);
    assert.throws(function () {range(2, math.complex(2,3))}, TypeError);
    assert.throws(function () {range(2, new Date(), 3)}, TypeError);
    assert.throws(function () {range(2, 1, math.unit('5cm'))}, TypeError);
    assert.throws(function () {range(math.complex(2,3), 1, 3)}, TypeError);
  });

  it('should throw an error if called with an invalid number of arguments', function() {
    assert.throws(function () {range()}, /TypeError: Too few arguments/);

    assert.throws(function () {range(1,2,3,true,5)}, /TypeError: Too many arguments/);
  });

  // FIXME: should give the right error
  it.skip('should not cast a single number or boolean to string', function() {
    assert.throws(function () {range(2)}, /TypeError: Too few arguments/);
    assert.throws(function () {range(boolean)}, /TypeError: Unexpected type of argument/);
  });


  it('should LaTeX range', function () {
    var expression = math.parse('range(1,10)');
    assert.equal(expression.toTex(), '\\mathrm{range}\\left(1,10\\right)');
  });
});
