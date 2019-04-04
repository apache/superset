var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index');

describe('map', function() {

  it('should apply map to all elements of the matrix', function() {
    var m = math.matrix([[1,2,3], [4,5,6]]);
    var m2 = math.map(m, function (value) { return value * 2; });
    assert.deepEqual(m2.valueOf(), [[2,4,6],[8,10,12]]);
    assert.ok(m2 instanceof math.type.Matrix);
  });

  it('should apply deep-map to all elements in the array', function() {
    var arr = [[1,2,3], [4,5,6]];
    var arr2 = math.map(arr, function (value) { return value * 2; });
    assert.deepEqual(arr2, [[2,4,6],[8,10,12]]);
    assert.ok(Array.isArray(arr2));
  });

  it('should invoke callback with parameters value, index, obj', function() {
    var arr = [[1,2,3], [4,5,6]];

    assert.deepEqual(math.map(arr, function (value, index, obj) {
      // we don't clone index here, this should return a copy with every iteration
      return [value, index, obj === arr];
    }).valueOf(), [
      [
        [1, [0, 0], true ],
        [2, [0, 1], true ],
        [3, [0, 2], true ]
      ],
      [
        [4, [1, 0], true ],
        [5, [1, 1], true ],
        [6, [1, 2], true ]
      ]
    ]);

  });

  it('should invoke a typed function with correct number of arguments (1)', function() {
    var output = math.map([1,2,3], math.typed('callback', {
      'number': function (value) {
        return value + 2
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (2)', function() {
    var output = math.map([1,2,3], math.typed('callback', {
      'number, Array': function (value, index) {
        return value + 2
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (3)', function() {
    var output = math.map([1,2,3], math.typed('callback', {
      'number, Array, Array': function (value, index, array) {
        return value + 2
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should throw an error if called with unsupported type', function() {
    assert.throws(function() { math.map(1, function() {}) });
    assert.throws(function() { math.map('arr', function() {}) });
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() { math.map([1, 2, 3]) });
  });

  it('should LaTeX map', function () {
    var expression = math.parse('map([1,2,3],callback)');
    assert.equal(expression.toTex(), '\\mathrm{map}\\left(\\begin{bmatrix}1\\\\2\\\\3\\\\\\end{bmatrix}, callback\\right)');
  });

});
