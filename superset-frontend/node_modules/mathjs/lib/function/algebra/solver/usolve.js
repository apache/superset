'use strict';

function factory (type, config, load, typed) {

  var matrix = load(require('../../../type/matrix/function/matrix'));
  var divideScalar = load(require('../../arithmetic/divideScalar'));
  var multiplyScalar = load(require('../../arithmetic/multiplyScalar'));
  var subtract = load(require('../../arithmetic/subtract'));
  var equalScalar = load(require('../../relational/equalScalar'));

  var solveValidation = load(require('./utils/solveValidation'));
  
  var DenseMatrix = type.DenseMatrix;

  /**
   * Solves the linear equation system by backward substitution. Matrix must be an upper triangular matrix.
   *
   * `U * x = b`
   *
   * Syntax:
   *
   *    math.usolve(U, b);
   *
   * Examples:
   *
   *    var a = [[-2, 3], [2, 1]];
   *    var b = [11, 9];
   *    var x = usolve(a, b);  // [[8], [9]]
   *
   * See also:
   *
   *    lup, slu, usolve, lusolve
   *
   * @param {Matrix, Array} U       A N x N matrix or array (U)
   * @param {Matrix, Array} b       A column vector with the b values
   *
   * @return {DenseMatrix | Array}  A column vector with the linear system solution (x)
   */
  var usolve = typed('usolve', {
    
    'SparseMatrix, Array | Matrix': function (m, b) {
      // process matrix
      return _sparseBackwardSubstitution(m, b);
    },

    'DenseMatrix, Array | Matrix': function (m, b) {
      // process matrix
      return _denseBackwardSubstitution(m, b);
    },

    'Array, Array | Matrix': function (a, b) {
      // create dense matrix from array
      var m = matrix(a);
      // use matrix implementation
      var r = _denseBackwardSubstitution(m, b);
      // result
      return r.valueOf();
    }
  });

  var _denseBackwardSubstitution = function (m, b) {
    // validate matrix and vector, return copy of column vector b
    b = solveValidation(m, b, true);
    // column vector data
    var bdata = b._data;
    // rows & columns
    var rows = m._size[0];
    var columns = m._size[1];
    // result
    var x = [];
    // arrays
    var data = m._data;
    // backward solve m * x = b, loop columns (backwards)
    for (var j = columns - 1; j >= 0 ; j--) {
      // b[j]
      var bj = bdata[j][0] || 0;
      // x[j]
      var xj;
      // backward substitution (outer product) avoids inner looping when bj == 0
      if (!equalScalar(bj, 0)) {
        // value @ [j, j]
        var vjj = data[j][j];
        // check vjj
        if (equalScalar(vjj, 0)) {
          // system cannot be solved
          throw new Error('Linear system cannot be solved since matrix is singular');
        }
        // calculate xj
        xj = divideScalar(bj, vjj);        
        // loop rows
        for (var i = j - 1; i >= 0; i--) {
          // update copy of b
          bdata[i] = [subtract(bdata[i][0] || 0, multiplyScalar(xj, data[i][j]))];
        }
      }
      else {
        // zero value @ j
        xj = 0;
      }
      // update x
      x[j] = [xj];
    }
    // return column vector
    return new DenseMatrix({
      data: x,
      size: [rows, 1]
    });
  };
  
  var _sparseBackwardSubstitution = function (m, b) {
    // validate matrix and vector, return copy of column vector b
    b = solveValidation(m, b, true);
    // column vector data
    var bdata = b._data;
    // rows & columns
    var rows = m._size[0];
    var columns = m._size[1];
    // matrix arrays
    var values = m._values;
    var index = m._index;
    var ptr = m._ptr;
    // vars
    var i, k;
    // result
    var x = [];
    // backward solve m * x = b, loop columns (backwards)
    for (var j = columns - 1; j >= 0 ; j--) {
      // b[j]
      var bj = bdata[j][0] || 0;
      // backward substitution (outer product) avoids inner looping when bj == 0
      if (!equalScalar(bj, 0)) {
        // value @ [j, j]
        var vjj = 0;
        // upper triangular matrix values & index (column j)
        var jvalues = [];
        var jindex = [];
        // first & last indeces in column
        var f = ptr[j];
        var l = ptr[j + 1];
        // values in column, find value @ [j, j], loop backwards
        for (k = l - 1; k >= f; k--) {
          // row
          i = index[k];
          // check row
          if (i === j) {
            // update vjj
            vjj = values[k];
          }
          else if (i < j) {
            // store upper triangular
            jvalues.push(values[k]);
            jindex.push(i);
          }
        }
        // at this point we must have a value @ [j, j]
        if (equalScalar(vjj, 0)) {
          // system cannot be solved, there is no value @ [j, j]
          throw new Error('Linear system cannot be solved since matrix is singular');
        }
        // calculate xj
        var xj = divideScalar(bj, vjj);
        // loop upper triangular
        for (k = 0, l = jindex.length; k < l; k++) {
          // row
          i = jindex[k];
          // update copy of b
          bdata[i] = [subtract(bdata[i][0], multiplyScalar(xj, jvalues[k]))];
        }
        // update x
        x[j] = [xj];
      }
      else {
        // update x
        x[j] = [0];
      }
    }
    // return vector
    return new DenseMatrix({
      data: x,
      size: [rows, 1]
    });
  };
  
  return usolve;
}

exports.name = 'usolve';
exports.factory = factory;
