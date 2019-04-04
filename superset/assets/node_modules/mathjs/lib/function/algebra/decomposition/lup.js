'use strict';

var util = require('../../../utils/index');

var object = util.object;

function factory (type, config, load, typed) {

  var matrix = load(require('../../../type/matrix/function/matrix'));
  var abs = load(require('../../arithmetic/abs'));
  var addScalar = load(require('../../arithmetic/addScalar'));
  var divideScalar = load(require('../../arithmetic/divideScalar'));
  var multiplyScalar = load(require('../../arithmetic/multiplyScalar'));
  var subtract = load(require('../../arithmetic/subtract'));
  var larger = load(require('../../relational/larger'));
  var equalScalar = load(require('../../relational/equalScalar'));
  var unaryMinus = load(require('../../arithmetic/unaryMinus'));
  
  var SparseMatrix = type.SparseMatrix;
  var DenseMatrix = type.DenseMatrix;
  var Spa = type.Spa;
  
  /**
   * Calculate the Matrix LU decomposition with partial pivoting. Matrix `A` is decomposed in two matrices (`L`, `U`) and a
   * row permutation vector `p` where `A[p,:] = L * U`
   *
   * Syntax:
   *
   *    math.lup(A);
   *
   * Example:
   *
   *    var m = [[2, 1], [1, 4]];
   *    var r = math.lup(m);
   *    // r = {
   *    //   L: [[1, 0], [0.5, 1]],
   *    //   U: [[2, 1], [0, 3.5]],
   *    //   P: [0, 1]
   *    // }
   *
   * See also:
   *
   *    slu, lsolve, lusolve, usolve
   *
   * @param {Matrix | Array} A    A two dimensional matrix or array for which to get the LUP decomposition.
   *
   * @return {{L: Array | Matrix, U: Array | Matrix, P: Array.<number>}} The lower triangular matrix, the upper triangular matrix and the permutation matrix.
   */
  var lup = typed('lup', {

    'DenseMatrix': function (m) {
      return _denseLUP(m);
    },
    
    'SparseMatrix': function (m) {
      return _sparseLUP(m);
    },

    'Array': function (a) {
      // create dense matrix from array
      var m = matrix(a);
      // lup, use matrix implementation
      var r = _denseLUP(m);
      // result
      return {
        L: r.L.valueOf(),
        U: r.U.valueOf(),
        p: r.p
      };
    }
  });

  var _denseLUP = function (m) {
    // rows & columns
    var rows = m._size[0];
    var columns = m._size[1];
    // minimum rows and columns
    var n = Math.min(rows, columns);
    // matrix array, clone original data
    var data = object.clone(m._data);
    // l matrix arrays
    var ldata = [];
    var lsize = [rows, n];
    // u matrix arrays
    var udata = [];
    var usize = [n, columns];
    // vars
    var i, j, k;
    // permutation vector    
    var p = [];
    for (i = 0; i < rows; i++)
      p[i] = i;    
    // loop columns
    for (j = 0; j < columns; j++) {
      // skip first column in upper triangular matrix
      if (j > 0) {
        // loop rows
        for (i = 0; i < rows; i++) {
          // min i,j
          var min = Math.min(i, j);
          // v[i, j]
          var s = 0;
          // loop up to min
          for (k = 0; k < min; k++) {
            // s = l[i, k] - data[k, j]
            s = addScalar(s, multiplyScalar(data[i][k], data[k][j]));
          }
          data[i][j] = subtract(data[i][j], s);
        }
      }      
      // row with larger value in cvector, row >= j
      var pi = j;
      var pabsv = 0;
      var vjj = 0;
      // loop rows
      for (i = j; i < rows; i++) {
        // data @ i, j
        var v = data[i][j];
        // absolute value
        var absv = abs(v);
        // value is greater than pivote value
        if (larger(absv, pabsv)) {
          // store row
          pi = i;
          // update max value
          pabsv = absv;
          // value @ [j, j]
          vjj = v;
        }
      }
      // swap rows (j <-> pi)
      if (j !== pi) {
        // swap values j <-> pi in p
        p[j] = [p[pi], p[pi] = p[j]][0];
        // swap j <-> pi in data
        DenseMatrix._swapRows(j, pi, data);
      }
      // check column is in lower triangular matrix
      if (j < rows) {
        // loop rows (lower triangular matrix)
        for (i = j + 1; i < rows; i++) {
          // value @ i, j
          var vij = data[i][j];
          if (!equalScalar(vij, 0)) {
            // update data
            data[i][j] = divideScalar(data[i][j], vjj);
          }
        }
      }
    }
    // loop columns
    for (j = 0; j < columns; j++) {
      // loop rows
      for (i = 0; i < rows; i++) {
        // initialize row in arrays
        if (j === 0) {
          // check row exists in upper triangular matrix
          if (i < columns) {
            // U
            udata[i] = [];
          }
          // L
          ldata[i] = [];
        }
        // check we are in the upper triangular matrix
        if (i < j) {
          // check row exists in upper triangular matrix
          if (i < columns) {
            // U
            udata[i][j] = data[i][j];
          }
          // check column exists in lower triangular matrix
          if (j < rows) {
            // L
            ldata[i][j] = 0;
          }
          continue;
        }
        // diagonal value
        if (i === j) {
          // check row exists in upper triangular matrix
          if (i < columns) {
            // U
            udata[i][j] = data[i][j];
          }
          // check column exists in lower triangular matrix
          if (j < rows) {
            // L
            ldata[i][j] = 1;
          }
          continue;
        }
        // check row exists in upper triangular matrix
        if (i < columns) {
          // U
          udata[i][j] = 0;
        }
        // check column exists in lower triangular matrix
        if (j < rows) {
          // L
          ldata[i][j] = data[i][j];
        }
      }
    }
    // l matrix
    var l =  new DenseMatrix({
      data: ldata,
      size: lsize
    });
    // u matrix
    var u =  new DenseMatrix({
      data: udata,
      size: usize
    });
    // p vector
    var pv = [];
    for (i = 0, n = p.length; i < n; i++)
      pv[p[i]] = i;
    // return matrices
    return { 
      L: l, 
      U: u, 
      p: pv, 
      toString: function () {
        return 'L: ' + this.L.toString() + '\nU: ' + this.U.toString() + '\nP: ' + this.p;
      }
    };
  };
  
  var _sparseLUP = function (m) {
    // rows & columns
    var rows = m._size[0];
    var columns = m._size[1];
    // minimum rows and columns
    var n = Math.min(rows, columns);
    // matrix arrays (will not be modified, thanks to permutation vector)
    var values = m._values;
    var index = m._index;
    var ptr = m._ptr;
    // l matrix arrays
    var lvalues = [];
    var lindex = [];
    var lptr = [];
    var lsize = [rows, n];
    // u matrix arrays
    var uvalues = [];
    var uindex = [];
    var uptr = [];
    var usize = [n, columns];
    // vars
    var i, j, k;
    // permutation vectors, (current index -> original index) and (original index -> current index)
    var pv_co = [];
    var pv_oc = [];
    for (i = 0; i < rows; i++) {
      pv_co[i] = i;
      pv_oc[i] = i;
    }
    // swap indices in permutation vectors (condition x < y)!
    var swapIndeces = function (x, y) {      
      // find pv indeces getting data from x and y
      var kx = pv_oc[x];
      var ky = pv_oc[y];
      // update permutation vector current -> original
      pv_co[kx] = y;
      pv_co[ky] = x;
      // update permutation vector original -> current
      pv_oc[x] = ky;
      pv_oc[y] = kx;
    };
    // loop columns
    for (j = 0; j < columns; j++) {
      // sparse accumulator
      var spa = new Spa();            
      // check lower triangular matrix has a value @ column j
      if (j < rows) {
        // update ptr
        lptr.push(lvalues.length);
        // first value in j column for lower triangular matrix
        lvalues.push(1);
        lindex.push(j);
      }
      // update ptr
      uptr.push(uvalues.length);
      // k0 <= k < k1 where k0 = _ptr[j] && k1 = _ptr[j+1]
      var k0 = ptr[j];
      var k1 = ptr[j + 1];
      // copy column j into sparse accumulator
      for (k = k0; k < k1; k++) {
        // row
        i = index[k];
        // copy column values into sparse accumulator (use permutation vector)
        spa.set(pv_co[i], values[k]);
      }
      // skip first column in upper triangular matrix
      if (j > 0) {
        // loop rows in column j (above diagonal)
        spa.forEach(0, j - 1, function (k, vkj) {
          // loop rows in column k (L)
          SparseMatrix._forEachRow(k, lvalues, lindex, lptr, function (i, vik) {
            // check row is below k
            if (i > k) {
              // update spa value
              spa.accumulate(i, unaryMinus(multiplyScalar(vik, vkj)));
            }
          });
        });        
      }
      // row with larger value in spa, row >= j
      var pi = j;
      var vjj = spa.get(j);
      var pabsv = abs(vjj);      
      // loop values in spa (order by row, below diagonal)
      spa.forEach(j + 1, rows - 1, function (x, v) {
        // absolute value
        var absv = abs(v);
        // value is greater than pivote value
        if (larger(absv, pabsv)) {
          // store row
          pi = x;
          // update max value
          pabsv = absv;
          // value @ [j, j]
          vjj = v;
        }
      });
      // swap rows (j <-> pi)
      if (j !== pi) {
        // swap values j <-> pi in L
        SparseMatrix._swapRows(j, pi, lsize[1], lvalues, lindex, lptr);
        // swap values j <-> pi in U
        SparseMatrix._swapRows(j, pi, usize[1], uvalues, uindex, uptr);
        // swap values in spa
        spa.swap(j, pi);
        // update permutation vector (swap values @ j, pi)
        swapIndeces(j, pi);
      }
      // loop values in spa (order by row)
      spa.forEach(0, rows - 1, function (x, v) {
        // check we are above diagonal
        if (x <= j) {
          // update upper triangular matrix
          uvalues.push(v);
          uindex.push(x);
        }
        else {
          // update value
          v = divideScalar(v, vjj);
          // check value is non zero
          if (!equalScalar(v, 0)) {
            // update lower triangular matrix
            lvalues.push(v);
            lindex.push(x);
          }
        }
      });
    }
    // update ptrs
    uptr.push(uvalues.length);
    lptr.push(lvalues.length);

    // return matrices
    return {
      L: new SparseMatrix({
        values: lvalues,
        index: lindex,
        ptr: lptr,
        size: lsize
      }), 
      U: new SparseMatrix({
        values: uvalues,
        index: uindex,
        ptr: uptr,
        size: usize
      }),
      p: pv_co,
      toString: function () {
        return 'L: ' + this.L.toString() + '\nU: ' + this.U.toString() + '\nP: ' + this.p;
      }
    };
  };
  
  return lup;
}

exports.name = 'lup';
exports.factory = factory;
