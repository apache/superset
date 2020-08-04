// test setIsSubset
var assert = require('assert');
var math = require('../../../index');

describe('setIsSubset', function () {
  it('should return true or false', function () {
    assert.strictEqual(math.setIsSubset([1, 2], [1, 2, 3, 4]), true);
    assert.strictEqual(math.setIsSubset([1, 2, 3, 4], [1, 2]), false);
    assert.strictEqual(math.setIsSubset([], [1, 2]), true);
    assert.strictEqual(math.setIsSubset([], []), true);

    assert.strictEqual(math.setIsSubset([1, math.complex(2,2)], [1, 3, 4, math.complex(2,2)]), true);
  });

  it('should return true or false', function () {
    assert.strictEqual(math.setIsSubset([1, 1, 2, 3, 4, 4], [1, 2, 3, 4, 4, 4]), false);
    assert.strictEqual(math.setIsSubset([1, 2, 3, 4, 4], [1, 2, 3, 4, 4, 4]), true);
    assert.strictEqual(math.setIsSubset([1, 2, 4, 3, 4], [1, 2, 4, 3, 4, 4]), true);
  });
  
  it('should return boolean', function() {
	assert.equal(math.typeof(math.setIsSubset([1, 2, 3], [3, 4, 5])), 'boolean');
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.setIsSubset();}, /TypeError: Too few arguments/);
    assert.throws(function () {math.setIsSubset([], [], []);}, /TypeError: Too many arguments/);
  });

});
