var assert = require('assert'),
    error = require('../../../lib/error/index'),
    math = require('../../../index');

describe('filter', function() {

  it('should filter an array with a filter function', function() {
    function isPositive (x) {
      return x > 0;
    }
    assert.deepEqual(math.filter([6, -2, -1, 4, 3], isPositive), [6, 4, 3]);
  });

  it('should filter a Matrix with a filter function', function() {
    function isPositive (x) {
      return x > 0;
    }
    assert.deepEqual(math.filter(math.matrix([6, -2, -1, 4, 3]), isPositive), math.matrix([6, 4, 3]));
  });

  it('should invoke callback with parameters value, index, obj', function() {
    var arr = [1,2,3];
    var log = [];

    math.filter(arr, function (value, index, obj) {
      log.push([value, index, obj === arr]);
      return true;
    }).valueOf();

    assert.deepEqual(log, [
      [1, [0], true ],
      [2, [1], true ],
      [3, [2], true ]
    ]);

  });

  it('should invoke a typed function with correct number of arguments (1)', function() {
    var output = [];
    math.filter([1,2,3], math.typed('callback', {
      'number': function (value) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (2)', function() {
    var output = [];
    math.filter([1,2,3], math.typed('callback', {
      'number, Array': function (value, index) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should invoke a typed function with correct number of arguments (3)', function() {
    var output = [];
    math.filter([1,2,3], math.typed('callback', {
      'number, Array, Array': function (value, index, array) {
        output.push(value + 2)
      }
    }));
    assert.deepEqual(output, [3,4,5]);
  });

  it('should filter an array with a regexp', function() {
    assert.deepEqual(math.filter(["23", "foo", "100", "55", "bar"], /[0-9]+/), ["23", "100", "55"]);
  });


  it('should filter a Matrix with a regexp', function() {
    assert.deepEqual(math.filter(math.matrix(["23", "foo", "100", "55", "bar"]), /[0-9]+/), math.matrix(["23", "100", "55"]));
  });

  it('should throw an error if called with a multi dimensional matrix', function() {
    function isPositive (x) {
      return x > 0;
    }
    assert.throws(function() { math.filter(math.matrix([[6, -2],[-1, 4]]), isPositive) }, /Only one dimensional matrices supported/);
  });

  it('should throw an error if called with unsupported type', function() {
    assert.throws(function() { math.filter(2, /regexp/) });
    assert.throws(function() { math.filter('string', /regexp/) });
    assert.throws(function() { math.filter([], 'string') });
    assert.throws(function() { math.filter([], {}) });
  });

  it('should throw an error if called with invalid number of arguments', function() {
    assert.throws(function() { math.filter([], /reg/, 'foo') });
    assert.throws(function() { math.filter([]) });
  });

  it('should LaTeX filter', function () {
    var expression = math.parse('filter(1,test)');
    assert.equal(expression.toTex(), '\\mathrm{filter}\\left(1, test\\right)');
  });

});
