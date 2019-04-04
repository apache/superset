var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    matrix = math.matrix,
    flatten = math.flatten;

describe('flatten', function() {

  it('should flatten an empty array', function () {
    assert.deepEqual(flatten([]), []);
  });

  it('should clone the flattened array', function () {
    var c = math.complex();
    var flat = flatten([c]);
    assert.deepEqual(flat, [c]);
    assert(c !== flat[0]);
  });

  it('should flatten a 1 dimensional array', function () {
    assert.deepEqual(flatten([1,2,3]), [1,2,3]);
  });

  it('should flatten a 2 dimensional array', function () {
    assert.deepEqual(flatten([[1,2],[3,4]]), [1,2,3,4]);
  });

  it('should flatten a 3 dimensional array', function () {
    assert.deepEqual(flatten([[[1,2],[3,4]],[[5,6],[7,8]]]), [1,2,3,4,5,6,7,8]);
  });

  it('should flatten a 1 dimensional matrix', function () {
    assert.deepEqual(flatten(matrix([1,2,3])), matrix([1,2,3]));
  });

  it('should flatten a 2 dimensional matrix', function () {
    assert.deepEqual(flatten(matrix([[1,2],[3,4]])), matrix([1,2,3,4]));
  });

  it('should flatten a 3 dimensional matrix', function () {
    assert.deepEqual(flatten(matrix([[[1,2],[3,4]],[[5,6],[7,8]]])), matrix([1,2,3,4,5,6,7,8]));
  });

  it('should throw an error on invalid arguments', function () {
    assert.throws(function () {flatten()}, /TypeError: Too few arguments/);
    assert.throws(function () {flatten([],2)}, /TypeError: Too many arguments/);
    assert.throws(function () {flatten("str")}, /TypeError: Unexpected type of argument/);
  });

  it('should LaTeX flatten', function () {
    var expression = math.parse('flatten([[1,2],[3,4]])');
    assert.equal(expression.toTex(), '\\mathrm{flatten}\\left(\\begin{bmatrix}1&2\\\\3&4\\\\\\end{bmatrix}\\right)');
  });

});
