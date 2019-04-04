'use strict';

var DimensionError = require('../../../error/DimensionError');

function factory (type, config, load, typed) {

  var equalScalar = load(require('../../../function/relational/equalScalar'));
  
  var SparseMatrix = type.SparseMatrix;

  /**
   * Iterates over SparseMatrix A and SparseMatrix B nonzero items and invokes the callback function f(Aij, Bij). 
   * Callback function invoked MAX(NNZA, NNZB) times
   *
   *
   *          ┌  f(Aij, Bij)  ; A(i,j) !== 0 || B(i,j) !== 0
   * C(i,j) = ┤  
   *          └  0            ; otherwise
   *
   *
   * @param {Matrix}   a                 The SparseMatrix instance (A)
   * @param {Matrix}   b                 The SparseMatrix instance (B)
   * @param {Function} callback          The f(Aij,Bij) operation to invoke
   *
   * @return {Matrix}                    SparseMatrix (C)
   *
   * see https://github.com/josdejong/mathjs/pull/346#issuecomment-97620294
   */
  var algorithm05 = function (a, b, callback) {
    // sparse matrix arrays
    var avalues = a._values;
    var aindex = a._index;
    var aptr = a._ptr;
    var asize = a._size;
    var adt = a._datatype;
    // sparse matrix arrays
    var bvalues = b._values;
    var bindex = b._index;
    var bptr = b._ptr;
    var bsize = b._size;
    var bdt = b._datatype;

    // validate dimensions
    if (asize.length !== bsize.length)
      throw new DimensionError(asize.length, bsize.length);

    // check rows & columns
    if (asize[0] !== bsize[0] || asize[1] !== bsize[1])
      throw new RangeError('Dimension mismatch. Matrix A (' + asize + ') must match Matrix B (' + bsize + ')');

    // rows & columns
    var rows = asize[0];
    var columns = asize[1];

    // datatype
    var dt;
    // equal signature to use
    var eq = equalScalar;
    // zero value
    var zero = 0;
    // callback signature to use
    var cf = callback;

    // process data types
    if (typeof adt === 'string' && adt === bdt) {
      // datatype
      dt = adt;
      // find signature that matches (dt, dt)
      eq = typed.find(equalScalar, [dt, dt]);
      // convert 0 to the same datatype
      zero = typed.convert(0, dt);
      // callback
      cf = typed.find(callback, [dt, dt]);
    }

    // result arrays
    var cvalues = avalues && bvalues ? [] : undefined;
    var cindex = [];
    var cptr = [];
    // matrix
    var c = new SparseMatrix({
      values: cvalues,
      index: cindex,
      ptr: cptr,
      size: [rows, columns],
      datatype: dt
    });

    // workspaces
    var xa = cvalues ? [] : undefined;
    var xb = cvalues ? [] : undefined;
    // marks indicating we have a value in x for a given column
    var wa = [];
    var wb = [];

    // vars
    var i, j, k, k1;
    
    // loop columns
    for (j = 0; j < columns; j++) {
      // update cptr
      cptr[j] = cindex.length;
      // columns mark
      var mark = j + 1;
      // loop values A(:,j)
      for (k = aptr[j], k1 = aptr[j + 1]; k < k1; k++) {
        // row
        i = aindex[k];
        // push index
        cindex.push(i);
        // update workspace
        wa[i] = mark;
        // check we need to process values
        if (xa)
          xa[i] = avalues[k];
      }
      // loop values B(:,j)
      for (k = bptr[j], k1 = bptr[j + 1]; k < k1; k++) {
        // row
        i = bindex[k];
        // check row existed in A
        if (wa[i] !== mark) {
          // push index
          cindex.push(i);
        }
        // update workspace
        wb[i] = mark;
        // check we need to process values
        if (xb)
          xb[i] = bvalues[k];
      }
      // check we need to process values (non pattern matrix)
      if (cvalues) {
        // initialize first index in j
        k = cptr[j];
        // loop index in j
        while (k < cindex.length) {
          // row
          i = cindex[k];
          // marks
          var wai = wa[i];
          var wbi = wb[i];
          // check Aij or Bij are nonzero
          if (wai === mark || wbi === mark) {
            // matrix values @ i,j
            var va = wai === mark ? xa[i] : zero;
            var vb = wbi === mark ? xb[i] : zero;
            // Cij
            var vc = cf(va, vb);
            // check for zero
            if (!eq(vc, zero)) {
              // push value
              cvalues.push(vc);
              // increment pointer
              k++;
            }
            else {
              // remove value @ i, do not increment pointer
              cindex.splice(k, 1);
            }
          }
        }
      }
    }
    // update cptr
    cptr[columns] = cindex.length;

    // return sparse matrix
    return c;
  };

  return algorithm05;
}

exports.name = 'algorithm05';
exports.factory = factory;
