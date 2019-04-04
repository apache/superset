// test setDifference
var assert = require('assert');
var math = require('../../../index');

describe('setDifference', function () {
  it('should return the difference of two sets', function () {
    assert.deepEqual(math.setDifference([1, 2, 3], [3, 4]), [1, 2]);
    assert.deepEqual(math.setDifference([3, 4], [1, 2, 3]), [4]);
    assert.deepEqual(math.setDifference([1, 2], [1, 2, 3, 4]), []);
    assert.deepEqual(math.setDifference([], [3, 4]), []);
    assert.deepEqual(math.setDifference([], []), []);
  });

  it('should return the difference of two sets with mixed content', function () {
    assert.deepEqual(math.setDifference([math.complex(5,1), 4], [1, 2, math.complex(5,1)]), [4]);
  });

  it('should return the difference of two multisets', function () {
    assert.deepEqual(math.setDifference([1, 1, 2, 3, 4, 4], [1, 2, 3, 4, 4, 4]), [1]);
    assert.deepEqual(math.setDifference([1, 2, 1, 3, 4, 4], [1, 2, 4, 3, 4, 4]), [1]);
  });
  
  it('should return the same type of output as the inputs', function() {
	assert.equal(math.typeof(math.setDifference([1, 2, 3], [3, 4, 5])), 'Array');
	assert.equal(math.typeof(math.setDifference(math.matrix([1, 2, 3]), math.matrix([3, 4, 5]))), 'Matrix');
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.setDifference();}, /TypeError: Too few arguments/);
    assert.throws(function () {math.setDifference([], [], []);}, /TypeError: Too many arguments/);
  });

});
