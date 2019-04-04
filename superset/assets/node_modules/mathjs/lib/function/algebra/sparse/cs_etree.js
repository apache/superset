'use strict';

function factory () {

  /**
   * Computes the elimination tree of Matrix A (using triu(A)) or the 
   * elimination tree of A'A without forming A'A.
   *
   * @param {Matrix}  a               The A Matrix
   * @param {boolean} ata             A value of true the function computes the etree of A'A
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_etree = function (a, ata) {
    // check inputs
    if (!a)
      return null;
    // a arrays
    var aindex = a._index;
    var aptr = a._ptr;
    var asize = a._size;
    // rows & columns
    var m = asize[0];
    var n = asize[1];
    
    // allocate result
    var parent = []; // (n)
    
    // allocate workspace
    var w = []; // (n + (ata ? m : 0))
    var ancestor = 0; // first n entries in w
    var prev = n; // last m entries (ata = true)
    
    var i, inext;
    
    // check we are calculating A'A
    if (ata) {
      // initialize workspace
      for (i = 0; i < m; i++) 
        w[prev + i] = -1;
    }
    // loop columns
    for (var k = 0; k < n; k++) {
      // node k has no parent yet
      parent[k] = -1;
      // nor does k have an ancestor
      w[ancestor + k] = -1;
      // values in column k
      for (var p0 = aptr[k], p1 = aptr[k + 1], p = p0; p < p1; p++) {
        // row
        var r = aindex[p];
        // node
        i = ata ? (w[prev + r]) : r;
        // traverse from i to k 
        for (; i != -1 && i < k; i = inext) {
          // inext = ancestor of i
          inext = w[ancestor + i];
          // path compression
          w[ancestor + i] = k;
          // check no anc., parent is k
          if (inext == -1) 
            parent[i] = k;
        }
        if (ata) 
          w[prev + r] = k;
      }
    }
    return parent;
  };

  return cs_etree;
}

exports.name = 'cs_etree';
exports.path = 'sparse';
exports.factory = factory;
