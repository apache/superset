// test transpose
var assert = require('assert'),
    math = require('../../../index'),
    transpose = math.transpose;

describe('transpose', function() {

  it('should transpose a scalar', function() {
    assert.deepEqual(transpose(3), 3);
  });

  it('should transpose a vector', function() {
    assert.deepEqual(transpose([1,2,3]), [1,2,3]);
    assert.deepEqual(transpose(math.matrix([1,2,3]).toArray()), [1,2,3]);
  });

  it('should transpose a 2d matrix', function() {
    assert.deepEqual(transpose([[1,2,3],[4,5,6]]), [[1,4],[2,5],[3,6]]);
    assert.deepEqual(transpose(math.matrix([[1,2,3],[4,5,6]]).toArray()), [[1,4],[2,5],[3,6]]);
    assert.deepEqual(transpose([[1,2],[3,4]]), [[1,3],[2,4]]);
    assert.deepEqual(transpose([[1,2,3,4]]), [[1],[2],[3],[4]]);
  });

  it('should throw an error for invalid matrix transpose', function() {
    assert.throws(function () {
      assert.deepEqual(transpose([[]]), [[]]);  // size [2,0]
    });
    assert.throws(function () {
      transpose([[[1],[2]],[[3],[4]]]); // size [2,2,1]
    });
  });

  it('should throw an error if called with an invalid number of arguments', function() {
    assert.throws(function () {transpose();}, /TypeError: Too few arguments/);
    assert.throws(function () {transpose([1,2],2);}, /TypeError: Too many arguments/);
  });
  
  describe('DenseMatrix', function () {

    it('should transpose a 2d matrix', function() {
      var m = math.matrix([[1,2,3],[4,5,6]]);
      var t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1,4],[2,5],[3,6]]);

      m = math.matrix([[1,4],[2,5],[3,6]]);
      t = transpose(m);
      assert.deepEqual(t.toArray(), [[1,2,3],[4,5,6]]);
      
      m = math.matrix([[1,2],[3,4]]);
      t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1,3],[2,4]]);

      m = math.matrix([[1,2,3,4]]);
      t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1],[2],[3],[4]]);
      
      m = math.matrix([[1,2,3,4]], 'dense', 'number');
      t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1],[2],[3],[4]]);
      assert.ok(t.datatype() === 'number');
    });

    it('should throw an error for invalid matrix transpose', function() {
      var m = math.matrix([[]]);
      assert.throws(function () { transpose(m); });

      m = math.matrix([[[1],[2]],[[3],[4]]]);
      assert.throws(function () { transpose(m); });
    });
  });
  
  describe('SparseMatrix', function () {

    it('should transpose a 2d matrix', function() {
      var m = math.sparse([[1,2,3],[4,5,6]]);
      var t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1,4],[2,5],[3,6]]);

      m = math.sparse([[1,4],[2,5],[3,6]]);
      t = transpose(m);
      assert.deepEqual(t.toArray(), [[1,2,3],[4,5,6]]);
      
      m = math.sparse([[1,2],[3,4]]);
      t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1,3],[2,4]]);

      m = math.sparse([[1,2,3,4]], 'number');
      t = transpose(m);
      assert.deepEqual(t.valueOf(), [[1],[2],[3],[4]]);
      assert.ok(t.datatype() === 'number');
    });

    it('should throw an error for invalid matrix transpose', function() {
      var m = math.matrix([[]], 'sparse');
      assert.throws(function () { transpose(m); });
    });
  });

  it('should LaTeX transpose', function () {
    var expression = math.parse('transpose([[1,2],[3,4]])');
    assert.equal(expression.toTex(), '\\left(\\begin{bmatrix}1&2\\\\3&4\\\\\\end{bmatrix}\\right)^\\top');
  });
});
