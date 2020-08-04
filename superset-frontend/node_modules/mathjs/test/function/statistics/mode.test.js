var assert = require('assert'),
    math = require('../../../index'),
    mode = math.mode,
    DenseMatrix = math.type.DenseMatrix;
;

describe('mode', function() {
  it('should return the mode accurately for one dimensional array', function() {
    assert.deepEqual(mode([1, 2.7, 3.2, 4, 2.7]), [2.7]);
    assert.deepEqual(mode([13, 24, 35, 46, 13]), [13]);
    assert.deepEqual(mode([1, 5, -5, 1]), [1]);
  });

  it('should return the correct mode when there are more than one values of mode', function() {
    assert.deepEqual(mode([1, 2.7, 3.2, 3.2, 4, 2.7]), [3.2, 2.7]);
    assert.deepEqual(mode([13, 24, 35, 46]), [13, 24, 35, 46]);
    assert.deepEqual(mode(['boston', 'delhi', 'cape town']), ['boston', 'delhi', 'cape town']);
  });

  it('should return the mode accurately for loose arguments', function() {
    assert.deepEqual(mode(2, 1, 4, 3, 1), [1]);
    assert.deepEqual(mode('a', 'b', 'c', 'b'), ['b']);
  });
  
  it('should return the mode of booleans', function() {
    assert.deepEqual(mode(true, true, false), [true]);
    assert.deepEqual(mode(true, [false, false]), [false]);
  });
  
  it('should return the mode correctly for different datatypes', function() {
    assert.deepEqual(mode(2, 1, 'f', 3.5, 1.0), [1]);
    assert.deepEqual(mode('a', 'b', 4, 'b'), ['b']);
  });
  
  it('should not throw an error if the input contains mixture of array and non-array values', function(){
    assert.deepEqual(mode(1, [3], [1, 2, 3, 7], 3, [8]), [3]);
    assert.deepEqual(mode([1], 3, [3]), [3]);
    assert.deepEqual(mode([13, 24],[35, 46]), [13, 24, 35, 46]);
    assert.deepEqual(mode([], 0), [0]);
  });
  
  it('should throw appropriate error if no parameters are assigned', function() {
    assert.throws(function() {mode([])});
    assert.throws(function() {mode()});
  });
  
  /* TODO :
  it('should throw appropriate error if parameters contain array of arrays or nested arrays', function(){
    assert.throws(function() {mode([1][3][3])});
    assert.throws(function() {mode([a[b, a]])});
  });
  */
  
  it('should return the mode of a 1D matrix', function() {
    assert.deepEqual(mode(new DenseMatrix([1, 3, 5, 2, -5, 3])), [3]);
  });
  
  it('should return the mode of a 2D matrix', function() {
    assert.deepEqual(mode(new DenseMatrix([
      [ 1, 4, 0],
      [ 3, 0, 5]
    ])), [0]);
  });
  
});
