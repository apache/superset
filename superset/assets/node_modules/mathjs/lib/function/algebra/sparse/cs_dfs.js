'use strict';

function factory (type, config, load) {

  var cs_marked = load(require('./cs_marked'));
  var cs_mark   = load(require('./cs_mark'));
  var cs_unflip = load(require('./cs_unflip'));

  /**
   * Depth-first search computes the nonzero pattern xi of the directed graph G (Matrix) starting
   * at nodes in B (see cs_reach()).
   *
   * @param {Number}  j               The starting node for the DFS algorithm
   * @param {Matrix}  g               The G matrix to search, ptr array modified, then restored
   * @param {Number}  top             Start index in stack xi[top..n-1]
   * @param {Number}  k               The kth column in B
   * @param {Array}   xi              The nonzero pattern xi[top] .. xi[n - 1], an array of size = 2 * n
   *                                  The first n entries is the nonzero pattern, the last n entries is the stack
   * @param {Array}   pinv            The inverse row permutation vector, must be null for L * x = b
   *
   * @return {Number}                 New value of top
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_dfs = function (j, g, top, xi, pinv) {
    // g arrays
    var index = g._index;
    var ptr = g._ptr;
    var size = g._size;
    // columns
    var n = size[1];
    // vars
    var i, p, p2;
    // initialize head
    var head = 0;
    // initialize the recursion stack
    xi[0] = j;
    // loop
    while (head >= 0) {
      // get j from the top of the recursion stack
      j = xi[head];
      // apply permutation vector
      var jnew = pinv ? pinv[j] : j;
      // check node j is marked
      if (!cs_marked(ptr, j)) {
        // mark node j as visited
        cs_mark(ptr, j);
        // update stack (last n entries in xi)
        xi[n + head] = jnew < 0 ? 0 : cs_unflip(ptr[jnew]);
      }
      // node j done if no unvisited neighbors
      var done = 1;
      // examine all neighbors of j, stack (last n entries in xi)
      for (p = xi[n + head], p2 = jnew < 0 ? 0 : cs_unflip(ptr[jnew+1]); p < p2; p++) {
        // consider neighbor node i
        i = index[p];
        // check we have visited node i, skip it
        if (cs_marked(ptr, i)) 
          continue;
        // pause depth-first search of node j, update stack (last n entries in xi)
        xi[n + head] = p;
        // start dfs at node i
        xi[++head] = i;
        // node j is not done
        done = 0;
        // break, to start dfs(i)
        break;
      }
      // check depth-first search at node j is done
      if (done) {
        // remove j from the recursion stack
        head--;
        // and place in the output stack
        xi[--top] = j;
      }
    }
    return top;    
  };

  return cs_dfs;
}

exports.name = 'cs_dfs';
exports.path = 'sparse';
exports.factory = factory;
