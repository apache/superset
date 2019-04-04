'use strict';

function factory (type, config, load, typed) {

  var equalScalar = load(require('../../../function/relational/equalScalar'));

  var SparseMatrix = type.SparseMatrix;

  /**
   * Iterates over SparseMatrix S nonzero items and invokes the callback function f(Sij, b). 
   * Callback function invoked NZ times (number of nonzero items in S).
   *
   *
   *          ┌  f(Sij, b)  ; S(i,j) !== 0
   * C(i,j) = ┤  
   *          └  0          ; otherwise
   *
   *
   * @param {Matrix}   s                 The SparseMatrix instance (S)
   * @param {Scalar}   b                 The Scalar value
   * @param {Function} callback          The f(Aij,b) operation to invoke
   * @param {boolean}  inverse           A true value indicates callback should be invoked f(b,Sij)
   *
   * @return {Matrix}                    SparseMatrix (C)
   *
   * https://github.com/josdejong/mathjs/pull/346#issuecomment-97626813
   */
  var algorithm11 = function (s, b, callback, inverse) {
    // sparse matrix arrays
    var avalues = s._values;
    var aindex = s._index;
    var aptr = s._ptr;
    var asize = s._size;
    var adt = s._datatype;

    // sparse matrix cannot be a Pattern matrix
    if (!avalues)
      throw new Error('Cannot perform operation on Pattern Sparse Matrix and Scalar value');

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
    if (typeof adt === 'string') {
      // datatype
      dt = adt;
      // find signature that matches (dt, dt)
      eq = typed.find(equalScalar, [dt, dt]);
      // convert 0 to the same datatype
      zero = typed.convert(0, dt);
      // convert b to the same datatype
      b = typed.convert(b, dt);
      // callback
      cf = typed.find(callback, [dt, dt]);
    }

    // result arrays
    var cvalues = [];
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

    // loop columns
    for (var j = 0; j < columns; j++) {
      // initialize ptr
      cptr[j] = cindex.length;
      // values in j
      for (var k0 = aptr[j], k1 = aptr[j + 1], k = k0; k < k1; k++) {
        // row
        var i = aindex[k];
        // invoke callback
        var v = inverse ? cf(b, avalues[k]) : cf(avalues[k], b);
        // check value is zero
        if (!eq(v, zero)) {
          // push index & value
          cindex.push(i);
          cvalues.push(v);
        }
      }
    }
    // update ptr
    cptr[columns] = cindex.length;

    // return sparse matrix
    return c;
  };

  return algorithm11;
}

exports.name = 'algorithm11';
exports.factory = factory;
