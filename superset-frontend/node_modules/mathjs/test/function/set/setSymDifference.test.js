// test setSymDifference
var assert = require('assert');
var math = require('../../../index');

describe('setSymDifference', function () {
  it('should return the symetric difference of two sets', function () {
    assert.deepEqual(math.setSymDifference([1, 2, 3], [3, 4]), [1, 2, 4]);
    assert.deepEqual(math.setSymDifference([3, 4], [1, 2, 3]), [4, 1, 2]);
    assert.deepEqual(math.setSymDifference([1, 2], [1, 2, 3, 4]), [3, 4]);
    assert.deepEqual(math.setSymDifference([], [3, 4]), [3, 4]);
    assert.deepEqual(math.setSymDifference([], []), []);
  });

  it('should return the symetric difference of two multisets', function () {
    assert.deepEqual(math.setSymDifference([1, 1, 2, 3, 4, 4], [1, 2, 3, 4, 4, 4]), [1, 4]);
  });
  
  it('should return the same type of output as the inputs', function() {
	assert.equal(math.typeof(math.setSymDifference([1, 2, 3], [3, 4, 5])), 'Array');
	assert.equal(math.typeof(math.setSymDifference(math.matrix([1, 2, 3]), math.matrix([3, 4, 5]))), 'Matrix');
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.setSymDifference();}, /TypeError: Too few arguments/);
    assert.throws(function () {math.setSymDifference([], [], []);}, /TypeError: Too many arguments/);
  });

});
