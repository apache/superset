'use strict';

var util = require('../../../../utils/index');

var string = util.string;
var array = util.array;

var isArray = Array.isArray;

function factory (type) {
  
  var DenseMatrix = type.DenseMatrix;

  /**
   * Validates matrix and column vector b for backward/forward substitution algorithms.
   *
   * @param {Matrix} m            An N x N matrix
   * @param {Array | Matrix} b    A column vector
   * @param {Boolean} copy        Return a copy of vector b
   *
   * @return {DenseMatrix}        Dense column vector b
   */
  var solveValidation = function (m, b, copy) {
    // matrix size
    var size = m.size();
    // validate matrix dimensions
    if (size.length !== 2)
      throw new RangeError('Matrix must be two dimensional (size: ' + string.format(size) + ')');
    // rows & columns
    var rows = size[0];
    var columns = size[1];    
    // validate rows & columns
    if (rows !== columns) 
      throw new RangeError('Matrix must be square (size: ' + string.format(size) + ')');
    // vars
    var data, i, bdata;
    // check b is matrix
    if (type.isMatrix(b)) {
      // matrix size
      var msize = b.size();
      // vector
      if (msize.length === 1) {
        // check vector length
        if (msize[0] !== rows)
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        // create data array
        data = [];
        // matrix data (DenseMatrix)
        bdata = b._data;
        // loop b data
        for (i = 0; i < rows; i++) {
          // row array
          data[i] = [bdata[i]];
        }
        // return Dense Matrix
        return new DenseMatrix({
          data: data,
          size: [rows, 1],
          datatype: b._datatype
        });
      }
      // two dimensions
      if (msize.length === 2) {
        // array must be a column vector
        if (msize[0] !== rows || msize[1] !== 1)
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        // check matrix type
        if (type.isDenseMatrix(b)) {
          // check a copy is needed
          if (copy) {
            // create data array
            data = [];
            // matrix data (DenseMatrix)
            bdata = b._data;
            // loop b data
            for (i = 0; i < rows; i++) {
              // row array
              data[i] = [bdata[i][0]];
            }
            // return Dense Matrix
            return new DenseMatrix({
              data: data,
              size: [rows, 1],
              datatype: b._datatype
            });
          }
          // b is already a column vector
          return b;
        }
        // create data array
        data = [];
        for (i = 0; i < rows; i++)
          data[i] = [0];
        // sparse matrix arrays
        var values = b._values;
        var index = b._index;
        var ptr = b._ptr;
        // loop values in column 0
        for (var k1 = ptr[1], k = ptr[0]; k < k1; k++) {
          // row
          i = index[k];
          // add to data
          data[i][0] = values[k]; 
        }
        // return Dense Matrix
        return new DenseMatrix({
          data: data,
          size: [rows, 1],
          datatype: b._datatype
        });
      }
      // throw error
      throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
    }
    // check b is array
    if (isArray(b)) {
      // size
      var asize = array.size(b);
      // check matrix dimensions, vector
      if (asize.length === 1) {
        // check vector length
        if (asize[0] !== rows)
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');        
        // create data array
        data = [];
        // loop b
        for (i = 0; i < rows; i++) {
          // row array
          data[i] = [b[i]];
        }
        // return Dense Matrix
        return new DenseMatrix({
          data: data,
          size: [rows, 1]
        });
      }
      if (asize.length === 2) {
        // array must be a column vector
        if (asize[0] !== rows || asize[1] !== 1)
          throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');
        // create data array
        data = [];
        // loop b data
        for (i = 0; i < rows; i++) {
          // row array
          data[i] = [b[i][0]];
        }
        // return Dense Matrix
        return new DenseMatrix({
          data: data,
          size: [rows, 1]
        });
      }
      // throw error
      throw new RangeError('Dimension mismatch. Matrix columns must match vector length.');      
    }
  };
  
  return solveValidation;
}

exports.factory = factory;