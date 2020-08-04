// test setPowerset
var assert = require('assert');
var math = require('../../../index');

describe('setPowerset', function () {
  it('should return the powerset of a set', function () {
    assert.deepEqual(math.setPowerset([1, 2]), [[], [1], [2], [1, 2]]);
    assert.deepEqual(math.setPowerset([1, math.complex(2,2)]),
        [[], [math.complex(2,2)], [1], [math.complex(2,2), 1]]);
    assert.deepEqual(math.setPowerset([]), []);
  });

  it('should return the powerset of a multiset', function () {
    assert.deepEqual(math.setPowerset([1, 1]), [[], [1], [1], [1, 1]]);
  });
  
  it('should always return an array', function() {
	assert.equal(math.typeof(math.setPowerset([1, 2, 3])), 'Array');
	assert.equal(math.typeof(math.setPowerset(math.matrix([1, 2, 3]))), 'Array');
  });

  it('should throw an error in case of invalid number of arguments', function() {
    assert.throws(function () {math.setPowerset();}, /TypeError: Too few arguments/);
    assert.throws(function () {math.setPowerset([], []);}, /TypeError: Too many arguments/);
  });

});
