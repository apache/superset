// test squeeze
var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index'),
    squeeze = math.squeeze,
    size = math.size,
    matrix = math.matrix;

describe('squeeze', function() {

  it('should squeeze an matrix', function() {
    var m = math.ones(matrix([1,3,2]));
    assert.deepEqual(size(m), matrix([1,3,2]));
    assert.deepEqual(size(m.valueOf()), [1,3,2]);
    assert.deepEqual(size(squeeze(m)), matrix([3,2]));

    m = math.ones(matrix([1,1,3]));
    assert.deepEqual(size(m), matrix([1,1,3]));
    assert.deepEqual(size(squeeze(m)), matrix([3]));
    assert.deepEqual(size(squeeze(math.range(1,6))), matrix([5]));

    assert.deepEqual(squeeze(2.3), 2.3);
    assert.deepEqual(squeeze(matrix([[5]])), 5);
  });

  it('should squeeze an array', function() {
    assert.deepEqual(squeeze([[2,3]]), [2,3]);
  });

  it('should throw an error if called with an invalid number of arguments', function() {
    assert.throws(function () {squeeze()}, /TypeError: Too few arguments/);
    assert.throws(function () {squeeze(1,2)}, /TypeError: Too many arguments/);
  });

  it('should LaTeX squeeze', function () {
    var expression = math.parse('squeeze([[0],[0]])');
    assert.equal(expression.toTex(), '\\mathrm{squeeze}\\left(\\begin{bmatrix}0\\\\0\\\\\\end{bmatrix}\\right)');
  });
});
