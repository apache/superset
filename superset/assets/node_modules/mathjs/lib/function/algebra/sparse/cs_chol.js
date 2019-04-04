'use strict';

function factory (type, config, load) {

  var divideScalar = load(require('../../arithmetic/divideScalar'));
  var sqrt = load(require('../../arithmetic/sqrt'));
  var subtract = load(require('../../arithmetic/subtract'));
  var multiply = load(require('../../arithmetic/multiply'));
  var im = load(require('../../complex/im'));
  var re = load(require('../../complex/re'));
  var conj = load(require('../../complex/conj'));
  var equal = load(require('../../relational/equal'));
  var smallerEq = load(require('../../relational/smallerEq'));

  var cs_symperm = load(require('./cs_symperm'));
  var cs_ereach  = load(require('./cs_ereach'));

  var SparseMatrix = type.SparseMatrix;

  /**
   * Computes the Cholesky factorization of matrix A. It computes L and P so
   * L * L' = P * A * P'
   *
   * @param {Matrix}  m               The A Matrix to factorize, only upper triangular part used
   * @param {Object}  s               The symbolic analysis from cs_schol()
   *
   * @return {Number}                 The numeric Cholesky factorization of A or null
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_chol = function (m, s) {
    // validate input
    if (!m)
      return null;
    // m arrays
    var size = m._size;
    // columns
    var n = size[1];
    // symbolic analysis result
    var parent = s.parent;
    var cp = s.cp;
    var pinv = s.pinv;
    // L arrays
    var lvalues = [];
    var lindex = [];
    var lptr = [];
    // L
    var L = new SparseMatrix({
      values: lvalues,
      index: lindex,
      ptr: lptr,
      size:[n, n]
    });
    // vars
    var c = []; // (2 * n)
    var x = []; // (n);
    // compute C = P * A * P'
    var cm = pinv ? cs_symperm (m, pinv, 1) : m;
    // C matrix arrays
    var cvalues = cm._values;
    var cindex = cm._index;
    var cptr = cm._ptr;
    // vars
    var k, p;
    // initialize variables
    for (k = 0; k < n; k++)
      lptr[k] = c[k] = cp[k];
    // compute L(k,:) for L*L' = C
    for (k = 0; k < n; k++) {
      // nonzero pattern of L(k,:)
      var top = cs_ereach(cm, k, parent, c);
      // x (0:k) is now zero
      x[k] = 0;
      // x = full(triu(C(:,k)))
      for (p = cptr[k]; p < cptr[k+1]; p++) {
        if (cindex[p] <= k) 
          x[cindex[p]] = cvalues[p];
      }
      // d = C(k,k)
      var d = x[k];
      // clear x for k+1st iteration
      x[k] = 0;
      // solve L(0:k-1,0:k-1) * x = C(:,k)
      for (; top < n; top++) {
        // s[top..n-1] is pattern of L(k,:)
        var i = s[top];
        // L(k,i) = x (i) / L(i,i)
        var lki = divideScalar(x[i], lvalues[lptr[i]]);
        // clear x for k+1st iteration
        x[i] = 0;
        for (p = lptr[i] + 1; p < c[i]; p++) {
          // row
          var r = lindex[p];
          // update x[r]
          x[r] = subtract(x[r], multiply(lvalues[p], lki));
        }
        // d = d - L(k,i)*L(k,i)
        d = subtract(d, multiply(lki, conj(lki)));
        p = c[i]++;
        // store L(k,i) in column i
        lindex[p] = k;
        lvalues[p] = conj(lki);
      }
      // compute L(k,k)
      if (smallerEq(re(d), 0) || !equal(im(d), 0)) {
        // not pos def
        return null;
      }
      p = c[k]++;
      //  store L(k,k) = sqrt(d) in column k
      lindex[p] = k;
      lvalues[p] = sqrt(d);
    }
    // finalize L
    lptr[n] = cp[n];
    // P matrix
    var P;
    // check we need to calculate P
    if (pinv) {
      // P arrays
      var pvalues = [];
      var pindex = [];
      var pptr = [];
      // create P matrix
      for (p = 0; p < n; p++) {
        // initialize ptr (one value per column)
        pptr[p] = p;
        // index (apply permutation vector)
        pindex.push(pinv[p]);
        // value 1
        pvalues.push(1);
      }
      // update ptr
      pptr[n] = n;
      // P
      P = new SparseMatrix({
        values: pvalues,
        index: pindex,
        ptr: pptr,
        size: [n, n]
      });
    }
    // return L & P
    return {
      L: L,
      P: P
    };
  };

  return cs_chol;
}

exports.name = 'cs_chol';
exports.path = 'sparse';
exports.factory = factory;
