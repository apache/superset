var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index');

describe('forEach', function() {

  it('should iterate over all elements of the matrix', function() {
    var m = math.matrix([1,2,3]);
    var output = [];
    math.forEach(m, function (value) { output.push(value); });
    assert.deepEqual(output, [1,2,3]);
  });

  it('should iterate deep over all elements in the array', function() {
    var arr = [1,2,3];
    var output = [];
    math.forEach(arr, function (value) { output.push(value); });
    assert.deepEqual(output, [1,2,3]);
  });

  it('should invoke a typed function with correct number of arguments (1)', function() {
    var output = [];
    math.forEach([1,2,3], math.typed('callback', {
      'number': function (value) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (2)', function() {
    var output = [];
    math.forEach([1,2,3], math.typed('callback', {
      'number, Array': function (value, index) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (3)', function() {
    var output = [];
    math.forEach([1,2,3], math.typed('callback', {
      'number, Array, Array': function (value, index, array) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke callback with parameters value, index, obj', function() {
    var arr = [[1,2,3], [4,5,6]];
    var output = [];

    math.forEach(arr, function (value, index, obj) {
      // note: we don't copy index, it should be a copy with each iteration
      output.push([value, index, obj === arr]);
    });
    assert.deepEqual(output, [
      [1, [0, 0], true ],
      [2, [0, 1], true ],
      [3, [0, 2], true ],
      [4, [1, 0], true ],
      [5, [1, 1], true ],
      [6, [1, 2], true ]
    ]);
  });

  it('should throw an error if called with unsupported type', function() {
    assert.throws(function() { math.forEach(1, function() {}) });
    assert.throws(function() { math.forEach('arr', function() {}) });
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() { math.forEach([1, 2, 3]) });
  });

  it('should LaTeX forEach', function () {
    var expression = math.parse('forEach([1,2,3],callback)');
    assert.equal(expression.toTex(), '\\mathrm{forEach}\\left(\\begin{bmatrix}1\\\\2\\\\3\\\\\\end{bmatrix}, callback\\right)');
  });

});
