'use strict';

function factory (type, config, load) {

  var cs_amd = load(require('./cs_amd'));
  var cs_permute = load(require('./cs_permute'));
  var cs_etree = load(require('./cs_etree'));
  var cs_post = load(require('./cs_post'));
  var cs_counts = load(require('./cs_counts'));

  /**
   * Symbolic ordering and analysis for QR and LU decompositions.
   *
   * @param {Number}  order           The ordering strategy (see cs_amd for more details)
   * @param {Matrix}  a               The A matrix
   * @param {boolean} qr              Symbolic ordering and analysis for QR decomposition (true) or
   *                                  symbolic ordering and analysis for LU decomposition (false)
   *
   * @return {Object}                 The Symbolic ordering and analysis for matrix A
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_sqr = function (order, a, qr) {
    // a arrays
    var aptr = a._ptr;
    var asize = a._size;
    // columns
    var n = asize[1];
    // vars
    var k;
    // symbolic analysis result
    var s = {};    
    // fill-reducing ordering
    s.q = cs_amd(order, a);
    // validate results
    if (order && !s.q) 
      return null;
    // QR symbolic analysis
    if (qr) {
      // apply permutations if needed
      var c = order ? cs_permute(a, null, s.q, 0) : a;
      // etree of C'*C, where C=A(:,q)
      s.parent = cs_etree(c, 1);
      // post order elimination tree
      var post = cs_post (s.parent, n);
      // col counts chol(C'*C)
      s.cp = cs_counts(c, s.parent, post, 1);
      // check we have everything needed to calculate number of nonzero elements
      if (c && s.parent && s.cp && _vcount(c, s)) {
        // calculate number of nonzero elements
        for (s.unz = 0, k = 0; k < n; k++) 
          s.unz += s.cp[k];
      }
    }
    else {
      // for LU factorization only, guess nnz(L) and nnz(U)
      s.unz = 4 * (aptr[n]) + n;
      s.lnz = s.unz;
    }
    // return result S
    return s;
  };
  
  /**
   * Compute nnz(V) = s.lnz, s.pinv, s.leftmost, s.m2 from A and s.parent
   */
  var _vcount = function (a, s) {
    // a arrays
    var aptr = a._ptr;
    var aindex = a._index;
    var asize = a._size;
    // rows & columns
    var m = asize[0];
    var n = asize[1];
    // initialize s arrays
    s.pinv = []; // (m + n);
    s.leftmost = []; // (m);
    // vars
    var parent = s.parent;
    var pinv = s.pinv;
    var leftmost = s.leftmost;
    // workspace, next: first m entries, head: next n entries, tail: next n entries, nque: next n entries
    var w = []; // (m + 3 * n);
    var next = 0;
    var head = m;
    var tail = m + n;
    var nque = m + 2 * n;
    // vars
    var i, k, p, p0, p1;
    // initialize w
    for (k = 0; k < n; k++) {
      // queue k is empty
      w[head + k] = -1;
      w[tail + k] = -1;
      w[nque + k] = 0;
    }
    // initialize row arrays
    for (i = 0; i < m; i++) 
      leftmost[i] = -1;
    // loop columns backwards    
    for (k = n - 1; k >= 0; k--) {
      // values & index for column k
      for (p0 = aptr[k], p1 = aptr[k + 1], p = p0; p < p1; p++) {
        // leftmost[i] = min(find(A(i,:)))
        leftmost[aindex[p]] = k;
      }
    }
    // scan rows in reverse order
    for (i = m - 1; i >= 0; i--) {
      // row i is not yet ordered
      pinv[i] = -1;
      k = leftmost[i];
      // check row i is empty
      if (k == -1) 
        continue;
      // first row in queue k
      if (w[nque + k]++ === 0) 
        w[tail + k] = i;
      // put i at head of queue k
      w[next + i] = w[head + k];
      w[head + k] = i;
    }
    s.lnz = 0;
    s.m2 = m;
    // find row permutation and nnz(V)
    for (k = 0; k < n; k++) {
      // remove row i from queue k
      i = w[head + k];
      // count V(k,k) as nonzero
      s.lnz++;
      // add a fictitious row
      if (i < 0) 
        i = s.m2++;
      // associate row i with V(:,k)
      pinv[i] = k;
      // skip if V(k+1:m,k) is empty
      if (--nque[k] <= 0) 
        continue;
      // nque[k] is nnz (V(k+1:m,k))
      s.lnz += w[nque + k];
      // move all rows to parent of k
      var pa = parent[k];
      if (pa != -1) {
        if (w[nque + pa] === 0) 
          w[tail + pa] = w[tail + k];
        w[next + w[tail + k]] = w[head + pa];
        w[head + pa] = w[next + i];
        w[nque + pa] += w[nque + k];
      }
    }
    for (i = 0; i < m; i++) {
      if (pinv[i] < 0) 
        pinv[i] = k++;
    }
    return true;
  };

  return cs_sqr;
}

exports.name = 'cs_sqr';
exports.path = 'sparse';
exports.factory = factory;
