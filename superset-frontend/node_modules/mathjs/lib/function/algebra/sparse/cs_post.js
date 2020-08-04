'use strict';

function factory (type, config, load) {

  var cs_tdfs = load(require('./cs_tdfs'));

  /**
   * Post order a tree of forest
   *
   * @param {Array}   parent          The tree or forest
   * @param {Number}  n               Number of columns
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_post = function (parent, n) {
    // check inputs
    if (!parent) 
      return null;
    // vars 
    var k = 0;
    var j;
    // allocate result
    var post = []; // (n);
    // workspace, head: first n entries, next: next n entries, stack: last n entries
    var w = []; // (3 * n);
    var head = 0; 
    var next = n; 
    var stack = 2 * n;
    // initialize workspace
    for (j = 0; j < n; j++) {
      // empty linked lists
      w[head + j] = -1;
    }
    // traverse nodes in reverse order
    for (j = n-1; j >= 0; j--) {
      // check j is a root
      if (parent[j] == -1) 
        continue;
      // add j to list of its parent
      w[next + j] = w[head + parent[j]];
      w[head + parent[j]] = j;
    }
    // loop nodes
    for (j = 0; j < n; j++) {
      // skip j if it is not a root
      if (parent[j] != -1) 
        continue;
      // depth-first search
      k = cs_tdfs(j, k, w, head, next, post, stack);
    }
    return post;
  };

  return cs_post;
}

exports.name = 'cs_post';
exports.path = 'sparse';
exports.factory = factory;
