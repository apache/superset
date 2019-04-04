var assert = require('assert');
var error = require('../../../lib/error/index');
var math = require('../../../index');
var composition = math.composition;

describe('composition', function() {

  it('should calculate the number of ways to compose a set of n objects into k non-empty subsets', function() {
    assert.equal(composition(5,3), 6);
    assert.equal(composition(1,1), 1);
    assert.equal(composition(8,3), 21);
  });

  it('should calculate the composition of n items taken k at a time with BigNumbers', function(){
    assert.deepEqual(composition(math.bignumber(7), math.bignumber(5)), math.bignumber(15));
    assert.deepEqual(composition(math.bignumber(70), math.bignumber(3)), math.bignumber(2346));
    assert.deepEqual(composition(math.bignumber(56), math.bignumber(11)), math.bignumber(29248649430));
  });

  it('should not work with non-integer and negative input', function() {
    assert.throws(function() {composition(0.5, 3)}, /TypeError: Positive integer value expected in function composition/);
    assert.throws(function() {composition(-2, 3)}, /TypeError: Positive integer value expected in function composition/);
    assert.throws(function() {composition(6, -2)}, /TypeError: Positive integer value expected in function composition/);
    assert.throws(function() {composition(3, 5)}, /TypeError: k must be less than or equal to n in function composition/);
    assert.throws(function() {composition(math.bignumber(3), math.bignumber(5))}, /TypeError: k must be less than or equal to n in function composition/);
    assert.throws(function() {composition(math.bignumber(3.5), math.bignumber(-3))}, /TypeError: Positive integer value expected in function composition/);
    assert.throws(function() {composition(math.bignumber(3.5), 0.25)}, /TypeError: Positive integer value expected in function composition/);
  });

  it('should not work with the wrong number or type of arguments', function() {
    assert.throws(function() {composition(5, 3, 2)});
    assert.throws(function() {composition(true, "hello world")});
  });
});
