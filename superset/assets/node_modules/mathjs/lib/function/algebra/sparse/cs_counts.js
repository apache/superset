'use strict';

function factory (type, config, load) {

  var transpose = load(require('../../matrix/transpose'));
  
  var cs_leaf = load(require('./cs_leaf'));

  /**
   * Computes the column counts using the upper triangular part of A.
   * It transposes A internally, none of the input parameters are modified.
   *
   * @param {Matrix} a           The sparse matrix A
   *
   * @param {Matrix} ata         Count the columns of A'A instead
   *
   * @return                     An array of size n of the column counts or null on error
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_counts = function (a, parent, post, ata) {
    // check inputs
    if (!a || !parent || !post) 
      return null;
    // a matrix arrays
    var asize = a._size;
    // rows and columns
    var m = asize[0];
    var n = asize[1];   
    // variables
    var i, j, k,  J,  p, p0, p1;
    
    // workspace size
    var s = 4 * n + (ata ? (n + m + 1) : 0);
    // allocate workspace
    var w = []; // (s)
    var ancestor = 0; // first n entries
    var maxfirst = n; // next n entries
    var prevleaf = 2 * n; // next n entries
    var first = 3 * n; // next n entries
    var head = 4 * n; // next n + 1 entries (used when ata is true)
    var next = 5 * n + 1; // last entries in workspace
    // clear workspace w[0..s-1]
    for (k = 0; k < s; k++) 
      w[k] = -1;
    
    // allocate result
    var colcount = []; // (n);
    
    // AT = A'
    var at = transpose(a);
    // at arrays
    var tindex = at._index;
    var tptr = at._ptr;

    // find w[first + j]
    for (k = 0; k < n; k++) {
      j = post[k];
      // colcount[j]=1 if j is a leaf
      colcount[j] = (w[first + j] == -1) ? 1 : 0;
      for (; j != -1 && w[first + j] == -1; j = parent[j]) 
        w[first + j] = k;
    }

    // initialize ata if needed
    if (ata) {
      // invert post
      for (k = 0; k < n; k++) 
        w[post[k]] = k;
      // loop rows (columns in AT)
      for (i = 0; i < m; i++) {
        // values in column i of AT
        for (k = n, p0 = tptr[i], p1 = tptr[i + 1], p = p0; p < p1; p++) 
          k = Math.min(k, w[tindex[p]]);
        // place row i in linked list k
        w[next + i] = w[head + k];
        w[head + k] = i;
      }
    }
    
    // each node in its own set
    for (i = 0; i < n; i++) 
      w[ancestor + i] = i;
    
    for (k = 0; k < n; k++) {
      // j is the kth node in postordered etree
      j = post[k];
      // check j is not a root
      if (parent[j] != -1) 
        colcount[parent[j]]--;
      
      // J=j for LL'=A case
      for (J = (ata ? w[head + k] : j); J != -1; J = (ata ? w[next + J] : -1)) {
        for (p = tptr[J]; p < tptr[J+1]; p++) {
          i = tindex[p];
          var r = cs_leaf(i, j, w, first, maxfirst, prevleaf, ancestor);
          // check A(i,j) is in skeleton
          if (r.jleaf >= 1) 
            colcount[j]++;
          // check account for overlap in q
          if (r.jleaf == 2) 
            colcount[r.q]--;
        }
      }
      if (parent[j] != -1) 
        w[ancestor + j] = parent[j];
    }
    // sum up colcount's of each child
    for (j = 0; j < n; j++) {
      if (parent[j] != -1) 
        colcount[parent[j]] += colcount[j];
    }
    return colcount;
  };

  return cs_counts;
}

exports.name = 'cs_counts';
exports.path = 'sparse';
exports.factory = factory;
