'use strict';

var clone = require('../../utils/object').clone;
var format = require('../../utils/string').format;

function factory (type, config, load, typed) {
  
  var matrix = load(require('../../type/matrix/function/matrix'));
  var add = load(require('../arithmetic/add'));

  /**
   * Calculate the trace of a matrix: the sum of the elements on the main
   * diagonal of a square matrix.
   *
   * Syntax:
   *
   *    math.trace(x)
   *
   * Examples:
   *
   *    math.trace([[1, 2], [3, 4]]); // returns 5
   *
   *    var A = [
   *      [1, 2, 3],
   *      [-1, 2, 3],
   *      [2, 0, 3]
   *    ]
   *    math.trace(A); // returns 6
   *
   * See also:
   *
   *    diag
   *
   * @param {Array | Matrix} x  A matrix
   *
   * @return {number} The trace of `x`
   */
  var trace = typed('trace', {
    
    'Array': function (x) {
      // use dense matrix implementation
      return trace(matrix(x));
    },

    'Matrix': function (x) {
      // result
      var c;
      // process storage format
      switch (x.storage()) {
        case 'dense':
          c = _denseTrace(x);
          break;
        case 'sparse':
          c = _sparseTrace(x);
          break;
      }
      return c;
    },
    
    'any': clone
  });
  
  var _denseTrace = function (m) {
    // matrix size & data
    var size = m._size;
    var data = m._data;
    
    // process dimensions
    switch (size.length) {
      case 1:
        // vector
        if (size[0] == 1) {
          // return data[0]
          return clone(data[0]);
        }
        throw new RangeError('Matrix must be square (size: ' + format(size) + ')');
      case 2:
        // two dimensional
        var rows = size[0];
        var cols = size[1];
        if (rows === cols) {
          // calulate sum
          var sum = 0;
          // loop diagonal
          for (var i = 0; i < rows; i++)
            sum = add(sum, data[i][i]);
          // return trace
          return sum;
        }
        throw new RangeError('Matrix must be square (size: ' + format(size) + ')');        
      default:
        // multi dimensional
        throw new RangeError('Matrix must be two dimensional (size: ' + format(size) + ')');
    }
  };
  
  var _sparseTrace = function (m) {
    // matrix arrays
    var values = m._values;
    var index = m._index;
    var ptr = m._ptr;
    var size = m._size;
    // check dimensions
    var rows = size[0];
    var columns = size[1];
    // matrix must be square
    if (rows === columns) {
      // calulate sum
      var sum = 0;
      // check we have data (avoid looping columns)
      if (values.length > 0) {
        // loop columns
        for (var j = 0; j < columns; j++) {
          // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
          var k0 = ptr[j];
          var k1 = ptr[j + 1];
          // loop k within [k0, k1[
          for (var k = k0; k < k1; k++) {
            // row index
            var i = index[k];
            // check row
            if (i === j) {
              // accumulate value
              sum = add(sum, values[k]);
              // exit loop
              break;
            }
            if (i > j) {
              // exit loop, no value on the diagonal for column j
              break;
            }
          }
        }
      }
      // return trace
      return sum;
    }
    throw new RangeError('Matrix must be square (size: ' + format(size) + ')');   
  };

  trace.toTex = {1: '\\mathrm{tr}\\left(${args[0]}\\right)'};
  
  return trace;
}

exports.name = 'trace';
exports.factory = factory;
