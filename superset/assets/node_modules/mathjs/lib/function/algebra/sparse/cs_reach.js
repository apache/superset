'use strict';

function factory (type, config, load) {

  var cs_dfs = load(require('./cs_dfs'));
  var cs_marked = load(require('./cs_marked'));
  var cs_mark = load(require('./cs_mark'));

  /**
   * The cs_reach function computes X = Reach(B), where B is the nonzero pattern of the n-by-1 
   * sparse column of vector b. The function returns the set of nodes reachable from any node in B. The
   * nonzero pattern xi of the solution x to the sparse linear system Lx=b is given by X=Reach(B).
   *
   * @param {Matrix}  g               The G matrix
   * @param {Matrix}  b               The B matrix
   * @param {Number}  k               The kth column in B
   * @param {Array}   xi              The nonzero pattern xi[top] .. xi[n - 1], an array of size = 2 * n
   *                                  The first n entries is the nonzero pattern, the last n entries is the stack
   * @param {Array}   pinv            The inverse row permutation vector
   *
   * @return {Number}                 The index for the nonzero pattern
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_reach = function (g, b, k, xi, pinv) {
    // g arrays
    var gptr = g._ptr;
    var gsize = g._size;
    // b arrays
    var bindex = b._index;
    var bptr = b._ptr;
    // columns
    var n = gsize[1];
    // vars
    var p, p0, p1;
    // initialize top
    var top = n;
    // loop column indeces in B
    for (p0 = bptr[k], p1 = bptr[k + 1], p = p0; p < p1; p++) {
      // node i
      var i = bindex[p];
      // check node i is marked
      if (!cs_marked(gptr, i)) {
        // start a dfs at unmarked node i
        top = cs_dfs(i, g, top, xi, pinv);
      }
    }
    // loop columns from top -> n - 1
    for (p = top; p < n; p++) {
      // restore G
      cs_mark(gptr, xi[p]);
    }
    return top;
  };

  return cs_reach;
}

exports.name = 'cs_reach';
exports.path = 'sparse';
exports.factory = factory;
