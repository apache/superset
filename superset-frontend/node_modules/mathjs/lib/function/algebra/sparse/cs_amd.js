'use strict';

function factory (type, config, load) {

  var cs_flip = load(require('./cs_flip'));
  var cs_fkeep = load(require('./cs_fkeep'));
  var cs_tdfs = load(require('./cs_tdfs'));
  
  var add       = load(require('../../arithmetic/add'));
  var multiply  = load(require('../../arithmetic/multiply'));
  var transpose = load(require('../../matrix/transpose'));

  /**
   * Approximate minimum degree ordering. The minimum degree algorithm is a widely used 
   * heuristic for finding a permutation P so that P*A*P' has fewer nonzeros in its factorization
   * than A. It is a gready method that selects the sparsest pivot row and column during the course
   * of a right looking sparse Cholesky factorization.
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   *
   * @param {Number} order    0: Natural, 1: Cholesky, 2: LU, 3: QR
   * @param {Matrix} m        Sparse Matrix
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_amd = function (order, a) {
    // check input parameters
    if (!a || order <= 0 || order > 3)
      return null;
    // a matrix arrays
    var asize = a._size;
    // rows and columns
    var m = asize[0];
    var n = asize[1];    
    // initialize vars
    var lemax = 0;
    // dense threshold
    var dense = Math.max(16, 10 * Math.sqrt(n));
    dense = Math.min(n - 2, dense);
    // create target matrix C
    var cm = _createTargetMatrix(order, a, m, n, dense);
    // drop diagonal entries
    cs_fkeep(cm, _diag, null);
    // C matrix arrays
    var cindex = cm._index;
    var cptr = cm._ptr;

    // number of nonzero elements in C
    var cnz = cptr[n];
    
    // allocate result (n+1)
    var P = [];
    
    // create workspace (8 * (n + 1))
    var W = [];
    var len = 0; // first n + 1 entries
    var nv = n + 1; // next n + 1 entries
    var next = 2 * (n + 1); // next n + 1 entries
    var head = 3 * (n + 1);  // next n + 1 entries
    var elen = 4 * (n + 1);  // next n + 1 entries
    var degree = 5 * (n + 1);  // next n + 1 entries
    var w = 6 * (n + 1);  // next n + 1 entries
    var hhead = 7 * (n + 1);  // last n + 1 entries    

    // use P as workspace for last
    var last = P;
    
    // initialize quotient graph
    var mark = _initializeQuotientGraph(n, cptr, W, len, head, last, next, hhead, nv, w, elen, degree);
    
    // initialize degree lists
    var nel = _initializeDegreeLists(n, cptr, W, degree, elen, w, dense, nv, head, last, next);
    
    // minimum degree node
    var mindeg = 0;
    
    // vars
    var i, j, k, k1, k2, e, pj, ln, nvi, pk, eln, p1, p2, pn, h, d;
    
    // while (selecting pivots) do
    while (nel < n) {
      // select node of minimum approximate degree. amd() is now ready to start eliminating the graph. It first
      // finds a node k of minimum degree and removes it from its degree list. The variable nel keeps track of thow
      // many nodes have been eliminated.
      for (k = -1; mindeg < n && (k = W[head + mindeg]) == -1; mindeg++);      
      if (W[next + k] != -1) 
        last[W[next + k]] = -1;
      // remove k from degree list
      W[head + mindeg] = W[next + k];
      // elenk = |Ek|
      var elenk = W[elen + k];
      // # of nodes k represents
      var nvk = W[nv + k];
      // W[nv + k] nodes of A eliminated
      nel += nvk;

      // Construct a new element. The new element Lk is constructed in place if |Ek| = 0. nv[i] is 
      // negated for all nodes i in Lk to flag them as members of this set. Each node i is removed from the
      // degree lists. All elements e in Ek are absorved into element k.
      var dk = 0;
      // flag k as in Lk
      W[nv + k] = -nvk;
      var p = cptr[k];
      // do in place if W[elen + k] == 0
      var pk1 = (elenk === 0) ? p : cnz;
      var pk2 = pk1;
      for (k1 = 1; k1 <= elenk + 1; k1++) {
        if (k1 > elenk) {
          // search the nodes in k
          e = k;
          // list of nodes starts at cindex[pj]
          pj = p;
          // length of list of nodes in k
          ln = W[len + k] - elenk;
        }
        else {
          // search the nodes in e
          e = cindex[p++];
          pj = cptr[e];
          // length of list of nodes in e
          ln = W[len + e];
        }
        for (k2 = 1; k2 <= ln; k2++) {
          i = cindex[pj++];
          // check  node i dead, or seen
          if ((nvi = W[nv + i]) <= 0) 
            continue;
          // W[degree + Lk] += size of node i
          dk += nvi;
          // negate W[nv + i] to denote i in Lk
          W[nv + i] = -nvi;
          // place i in Lk
          cindex[pk2++] = i;
          if (W[next + i] != -1) 
            last[W[next + i]] = last[i];
          // check we need to remove i from degree list
          if (last[i] != -1) 
            W[next + last[i]] = W[next + i];
          else
            W[head + W[degree + i]] = W[next + i];
        }
        if (e != k) {
          // absorb e into k
          cptr[e] = cs_flip(k);
          // e is now a dead element
          W[w + e] = 0;
        }
      }
      // cindex[cnz...nzmax] is free
      if (elenk !== 0) 
        cnz = pk2;
      // external degree of k - |Lk\i|
      W[degree + k] = dk;
      // element k is in cindex[pk1..pk2-1]
      cptr[k] = pk1;
      W[len + k] = pk2 - pk1;
      // k is now an element
      W[elen + k] = -2;
            
      // Find set differences. The scan1 function now computes the set differences |Le \ Lk| for all elements e. At the start of the
      // scan, no entry in the w array is greater than or equal to mark.
      
      // clear w if necessary
      mark = _wclear(mark, lemax, W, w, n);
      // scan 1: find |Le\Lk|
      for (pk = pk1; pk < pk2; pk++) {
        i = cindex[pk];
        // check if W[elen + i] empty, skip it
        if ((eln = W[elen + i]) <= 0) 
          continue;
        // W[nv + i] was negated
        nvi = -W[nv + i];
        var wnvi = mark - nvi;
        // scan Ei
        for (p = cptr[i], p1 = cptr[i] + eln - 1; p <= p1; p++) {
          e = cindex[p];
          if (W[w + e] >= mark) {
            // decrement |Le\Lk|
            W[w + e] -= nvi;
          }
          else if (W[w + e] !== 0) {
            // ensure e is a live element, 1st time e seen in scan 1
            W[w + e] = W[degree + e] + wnvi;
          }
        }
      }
      
      // degree update
      // The second pass computes the approximate degree di, prunes the sets Ei and Ai, and computes a hash
      // function h(i) for all nodes in Lk.
      
      // scan2: degree update
      for (pk = pk1; pk < pk2; pk++) {
        // consider node i in Lk
        i = cindex[pk];
        p1 = cptr[i];
        p2 = p1 + W[elen + i] - 1;
        pn = p1;
        // scan Ei
        for (h = 0, d = 0, p = p1; p <= p2; p++) {
          e = cindex[p];
          // check e is an unabsorbed element
          if (W[w + e] !== 0) {
            // dext = |Le\Lk|
            var dext = W[w + e] - mark;
            if (dext > 0) {
              // sum up the set differences
              d += dext;
              // keep e in Ei
              cindex[pn++] = e;
              // compute the hash of node i
              h += e;
            }
            else {
              // aggressive absorb. e->k
              cptr[e] = cs_flip(k);
              // e is a dead element
              W[w + e] = 0;
            }
          }
        }
        // W[elen + i] = |Ei|
        W[elen + i] = pn - p1 + 1;
        var p3 = pn;
        var p4 = p1 + W[len + i];
        // prune edges in Ai
        for (p = p2 + 1; p < p4; p++) {
          j = cindex[p];
          // check node j dead or in Lk
          var nvj = W[nv + j];
          if (nvj <= 0) 
            continue;
          // degree(i) += |j|
          d += nvj;
          // place j in node list of i
          cindex[pn++] = j;
          // compute hash for node i
          h += j;
        }
        // check for mass elimination
        if (d === 0) {
          // absorb i into k
          cptr[i] = cs_flip(k);
          nvi = -W[nv + i];
          // |Lk| -= |i|
          dk -= nvi;
          // |k| += W[nv + i]
          nvk += nvi;
          nel += nvi;
          W[nv + i] = 0;
          // node i is dead
          W[elen + i] = -1;
        }
        else {
          // update degree(i)
          W[degree + i] = Math.min(W[degree + i], d);
          // move first node to end
          cindex[pn] = cindex[p3];
          // move 1st el. to end of Ei
          cindex[p3] = cindex[p1];
          // add k as 1st element in of Ei
          cindex[p1] = k;
          // new len of adj. list of node i
          W[len + i] = pn - p1 + 1;
          // finalize hash of i
          h = (h < 0 ? -h : h) % n;
          // place i in hash bucket
          W[next + i] = W[hhead + h];
          W[hhead + h] = i;
          // save hash of i in last[i]
          last[i] = h;
        }
      }
      // finalize |Lk|
      W[degree + k] = dk;
      lemax = Math.max(lemax, dk);
      // clear w
      mark = _wclear(mark + lemax, lemax, W, w, n);
      
      // Supernode detection. Supernode detection relies on the hash function h(i) computed for each node i.
      // If two nodes have identical adjacency lists, their hash functions wil be identical.
      for (pk = pk1; pk < pk2; pk++) {
        i = cindex[pk];
        // check i is dead, skip it
        if (W[nv + i] >= 0) 
          continue;
        // scan hash bucket of node i
        h = last[i];
        i = W[hhead + h];
        // hash bucket will be empty
        W[hhead + h] = -1;
        for (; i != -1 && W[next + i] != -1; i = W[next + i], mark++) {
          ln = W[len + i];
          eln = W[elen + i];
          for (p = cptr[i] + 1; p <= cptr[i] + ln - 1; p++) 
            W[w + cindex[p]] = mark;
          var jlast = i;
          // compare i with all j
          for (j = W[next + i]; j != -1; ) {
            var ok = W[len + j] === ln && W[elen + j] === eln;
            for (p = cptr[j] + 1; ok && p <= cptr[j] + ln - 1; p++) {
              // compare i and j
              if (W[w + cindex[p]] != mark) 
                ok = 0;
            }
            // check i and j are identical
            if (ok) {
              // absorb j into i
              cptr[j] = cs_flip(i);
              W[nv + i] += W[nv + j];
              W[nv + j] = 0;
              // node j is dead
              W[elen + j] = -1;
              // delete j from hash bucket
              j = W[next + j];
              W[next + jlast] = j;
            }
            else {
              // j and i are different
              jlast = j;
              j = W[next + j];
            }
          }
        }
      }
      
      // Finalize new element. The elimination of node k is nearly complete. All nodes i in Lk are scanned one last time.
      // Node i is removed from Lk if it is dead. The flagged status of nv[i] is cleared.
      for (p = pk1, pk = pk1; pk < pk2; pk++) {
        i = cindex[pk];
        // check  i is dead, skip it
        if ((nvi = -W[nv + i]) <= 0) 
          continue;
        // restore W[nv + i]
        W[nv + i] = nvi;
        // compute external degree(i)
        d = W[degree + i] + dk - nvi;
        d = Math.min(d, n - nel - nvi);
        if (W[head + d] != -1) 
          last[W[head + d]] = i;
        // put i back in degree list
        W[next + i] = W[head + d];
        last[i] = -1;
        W[head + d] = i;
        // find new minimum degree
        mindeg = Math.min(mindeg, d);
        W[degree + i] = d;
        // place i in Lk
        cindex[p++] = i;
      }
      // # nodes absorbed into k
      W[nv + k] = nvk;
      // length of adj list of element k
      if ((W[len + k] = p - pk1) === 0) {
        // k is a root of the tree
        cptr[k] = -1;
        // k is now a dead element
        W[w + k] = 0;
      }
      if (elenk !== 0) {
        // free unused space in Lk
        cnz = p;
      }
    }
    
    // Postordering. The elimination is complete, but no permutation has been computed. All that is left 
    // of the graph is the assembly tree (ptr) and a set of dead nodes and elements (i is a dead node if
    // nv[i] is zero and a dead element if nv[i] > 0). It is from this information only that the final permutation
    // is computed. The tree is restored by unflipping all of ptr.
    
    // fix assembly tree
    for (i = 0; i < n; i++) 
      cptr[i] = cs_flip(cptr[i]);
    for (j = 0; j <= n; j++) 
      W[head + j] = -1;
    // place unordered nodes in lists
    for (j = n; j >= 0; j--) {
      // skip if j is an element
      if (W[nv + j] > 0)
        continue;
      // place j in list of its parent
      W[next + j] = W[head + cptr[j]];
      W[head + cptr[j]] = j;
    }
    // place elements in lists
    for (e = n; e >= 0; e--) {
      // skip unless e is an element
      if (W[nv + e] <= 0)
        continue;
      if (cptr[e] != -1) {
        // place e in list of its parent
        W[next + e] = W[head + cptr[e]];
        W[head + cptr[e]] = e;
      }
    }
    // postorder the assembly tree
    for (k = 0, i = 0; i <= n; i++) {
      if (cptr[i] == -1) 
        k = cs_tdfs(i, k, W, head, next, P, w);
    }
    // remove last item in array
    P.splice(P.length - 1, 1);
    // return P
    return P;
  };
  
  /**
   * Creates the matrix that will be used by the approximate minimum degree ordering algorithm. The function accepts the matrix M as input and returns a permutation
   * vector P. The amd algorithm operates on a symmetrix matrix, so one of three symmetric matrices is formed.
   *
   * Order: 0
   *   A natural ordering P=null matrix is returned.
   *
   * Order: 1
   *   Matrix must be square. This is appropriate for a Cholesky or LU factorization.
   *   P = M + M'
   *
   * Order: 2
   *   Dense columns from M' are dropped, M recreated from M'. This is appropriatefor LU factorization of unsymmetric matrices.
   *   P = M' * M
   * 
   * Order: 3
   *   This is best used for QR factorization or LU factorization is matrix M has no dense rows. A dense row is a row with more than 10*sqr(columns) entries.
   *   P = M' * M
   */
  var _createTargetMatrix = function (order, a, m, n, dense) {
    // compute A'
    var at = transpose(a);

    // check order = 1, matrix must be square
    if (order === 1 && n === m) {
      // C = A + A'
      return add(a, at);
    }
    
    // check order = 2, drop dense columns from M'
    if (order == 2) {
      // transpose arrays
      var tindex = at._index;
      var tptr = at._ptr;
      // new column index
      var p2 = 0;
      // loop A' columns (rows)
      for (var j = 0; j < m; j++) {
        // column j of AT starts here
        var p = tptr[j];
        // new column j starts here
        tptr[j] = p2;
        // skip dense col j
        if (tptr[j + 1] - p > dense) 
          continue;
        // map rows in column j of A
        for (var p1 = tptr[j + 1]; p < p1; p++) 
          tindex[p2++] = tindex[p];
      }
      // finalize AT
      tptr[m] = p2;
      // recreate A from new transpose matrix
      a = transpose(at);
      // use A' * A
      return multiply(at, a);
    }
    
    // use A' * A, square or rectangular matrix
    return multiply(at, a);
  };

  /**
   * Initialize quotient graph. There are four kind of nodes and elements that must be represented:
   *
   *  - A live node is a node i (or a supernode) that has not been selected as a pivot nad has not been merged into another supernode.
   *  - A dead node i is one that has been removed from the graph, having been absorved into r = flip(ptr[i]).
   *  - A live element e is one that is in the graph, having been formed when node e was selected as the pivot.
   *  - A dead element e is one that has benn absorved into a subsequent element s = flip(ptr[e]).
   */
  var _initializeQuotientGraph = function (n, cptr, W, len, head, last, next, hhead, nv, w, elen, degree) {
    // Initialize quotient graph
    for (var k = 0; k < n; k++) 
      W[len + k] = cptr[k + 1] - cptr[k];
    W[len + n] = 0;
    // initialize workspace
    for (var i = 0; i <= n; i++) {
      // degree list i is empty
      W[head + i] = -1;
      last[i] = -1;
      W[next + i] = -1;
      // hash list i is empty
      W[hhead + i] = -1;
      // node i is just one node
      W[nv + i] = 1;
      // node i is alive
      W[w + i] = 1;
      // Ek of node i is empty
      W[elen + i] = 0;
      // degree of node i
      W[degree + i] = W[len + i];
    }
    // clear w
    var mark = _wclear(0, 0, W, w, n);
    // n is a dead element
    W[elen + n] = -2;
    // n is a root of assembly tree
    cptr[n] = -1;
    // n is a dead element
    W[w + n] = 0;
    // return mark
    return mark;
  };

  /**
   * Initialize degree lists. Each node is placed in its degree lists. Nodes of zero degree are eliminated immediately. Nodes with 
   * degree >= dense are alsol eliminated and merged into a placeholder node n, a dead element. Thes nodes will appera last in the
   * output permutation p.
   */
  var _initializeDegreeLists = function (n, cptr, W, degree, elen, w, dense, nv, head, last, next) {
    // result
    var nel = 0;
    // loop columns
    for (var i = 0; i < n; i++) {
      // degree @ i
      var d = W[degree + i];
      // check node i is empty
      if (d === 0) {
        // element i is dead
        W[elen + i] = -2;
        nel++;
        // i is a root of assembly tree
        cptr[i] = -1;
        W[w + i] = 0;
      }
      else if (d > dense) {
        // absorb i into element n
        W[nv + i] = 0;
        // node i is dead
        W[elen + i] = -1;
        nel++;
        cptr[i] = cs_flip(n);
        W[nv + n]++;
      }
      else {
        var h = W[head + d];
        if (h != -1)
          last[h] = i;
        // put node i in degree list d
        W[next + i] = W[head + d];
        W[head + d] = i;
      }
    }
    return nel;
  };

  var _wclear = function(mark, lemax, W, w, n) {
    if (mark < 2 || (mark + lemax < 0)) {
      for (var k = 0; k < n; k++) {
        if (W[w + k] !== 0)
          W[w + k] = 1;
      }
      mark = 2 ;
    }
    // at this point, W [0..n-1] < mark holds
    return mark;
  };
  
  var _diag = function (i, j) { 
    return i != j;
  };
  
  return cs_amd;
}

exports.name = 'cs_amd';
exports.path = 'sparse';
exports.factory = factory;
