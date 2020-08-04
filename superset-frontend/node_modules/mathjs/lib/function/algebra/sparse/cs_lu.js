'use strict';

function factory (type, config, load) {

  var abs = load(require('../../arithmetic/abs'));
  var divideScalar = load(require('../../arithmetic/divideScalar'));
  var multiply = load(require('../../arithmetic/multiply'));
  
  var larger = load(require('../../relational/larger'));
  var largerEq = load(require('../../relational/largerEq'));
  
  var cs_spsolve = load(require('./cs_spsolve'));

  var SparseMatrix = type.SparseMatrix;

  /**
   * Computes the numeric LU factorization of the sparse matrix A. Implements a Left-looking LU factorization
   * algorithm that computes L and U one column at a tume. At the kth step, it access columns 1 to k-1 of L 
   * and column k of A. Given the fill-reducing column ordering q (see parameter s) computes L, U and pinv so
   * L * U = A(p, q), where p is the inverse of pinv.
   *
   * @param {Matrix}  m               The A Matrix to factorize
   * @param {Object}  s               The symbolic analysis from cs_sqr(). Provides the fill-reducing 
   *                                  column ordering q
   * @param {Number}  tol             Partial pivoting threshold (1 for partial pivoting)
   *
   * @return {Number}                 The numeric LU factorization of A or null
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_lu = function (m, s, tol) {
    // validate input
    if (!m)
      return null;
    // m arrays
    var size = m._size;
    // columns
    var n = size[1];
    // symbolic analysis result
    var q;
    var lnz = 100;
    var unz = 100;
    // update symbolic analysis parameters
    if (s) {
      q = s.q;
      lnz = s.lnz || lnz;
      unz = s.unz || unz;
    }
    // L arrays
    var lvalues = []; // (lnz)
    var lindex = []; // (lnz);
    var lptr = []; // (n + 1);
    // L
    var L = new SparseMatrix({
      values: lvalues,
      index: lindex,
      ptr: lptr,
      size: [n, n]
    });
    // U arrays
    var uvalues = []; // (unz);
    var uindex = []; // (unz);
    var uptr = []; // (n + 1);
    // U
    var U = new SparseMatrix({
      values: uvalues,
      index: uindex,
      ptr: uptr,
      size: [n, n]
    });
    // inverse of permutation vector
    var pinv = []; // (n);
    // vars 
    var i, p;
    // allocate arrays
    var x = []; // (n);
    var xi = []; // (2 * n);
    // initialize variables
    for (i = 0; i < n; i++) {
      // clear workspace
      x[i] = 0;
      // no rows pivotal yet
      pinv[i] = -1;
      // no cols of L yet
      lptr[i + 1] = 0;
    }
    // reset number of nonzero elements in L and U
    lnz = 0;
    unz = 0;
    // compute L(:,k) and U(:,k)
    for (var k = 0; k < n; k++) {
      // update ptr
      lptr[k] = lnz;
      uptr[k] = unz;
      // apply column permutations if needed
      var col = q ? q[k] : k;
      // solve triangular system, x = L\A(:,col)
      var top = cs_spsolve(L, m, col, xi, x, pinv, 1);
      // find pivot
      var ipiv = -1;
      var a = -1;
      // loop xi[] from top -> n
      for (p = top; p < n; p++) {
        // x[i] is nonzero
        i = xi[p];
        // check row i is not yet pivotal
        if (pinv[i] < 0) {
          // absolute value of x[i]          
          var xabs = abs(x[i]);
          // check absoulte value is greater than pivot value
          if (larger(xabs, a)) {
            // largest pivot candidate so far
            a = xabs;
            ipiv = i;
          }
        }
        else {
          // x(i) is the entry U(pinv[i],k)
          uindex[unz] = pinv[i];
          uvalues[unz++] = x[i];
        }
      }
      // validate we found a valid pivot
      if (ipiv == -1 || a <= 0) 
        return null;
      // update actual pivot column, give preference to diagonal value
      if (pinv[col] < 0 && largerEq(abs(x[col]), multiply(a, tol)))
        ipiv = col;
      // the chosen pivot
      var pivot = x[ipiv];
      // last entry in U(:,k) is U(k,k)
      uindex[unz] = k;
      uvalues[unz++] = pivot;
      // ipiv is the kth pivot row
      pinv[ipiv] = k;
      // first entry in L(:,k) is L(k,k) = 1
      lindex[lnz] = ipiv;
      lvalues[lnz++] = 1;
      // L(k+1:n,k) = x / pivot      
      for (p = top; p < n; p++) {
        // row
        i = xi[p];
        // check x(i) is an entry in L(:,k)
        if (pinv[i] < 0) {
          // save unpermuted row in L
          lindex[lnz] = i;
          // scale pivot column
          lvalues[lnz++] = divideScalar(x[i], pivot);
        }
        // x[0..n-1] = 0 for next k
        x[i] = 0;
      }
    }
    // update ptr
    lptr[n] = lnz;
    uptr[n] = unz;
    // fix row indices of L for final pinv
    for (p = 0; p < lnz; p++) 
      lindex[p] = pinv[lindex[p]];
    // trim arrays
    lvalues.splice(lnz, lvalues.length - lnz);
    lindex.splice(lnz, lindex.length - lnz);
    uvalues.splice(unz, uvalues.length - unz);
    uindex.splice(unz, uindex.length - unz);    
    // return LU factor
    return {
      L: L,
      U: U,
      pinv: pinv
    };
  };

  return cs_lu;
}

exports.name = 'cs_lu';
exports.path = 'sparse';
exports.factory = factory;
