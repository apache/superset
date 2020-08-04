'use strict';

function factory () {

  /**
   * This function determines if j is a leaf of the ith row subtree.
   * Consider A(i,j), node j in ith row subtree and return lca(jprev,j)
   *
   * @param {Number}  i               The ith row subtree
   * @param {Number}  j               The node to test
   * @param {Array}   w               The workspace array
   * @param {Number}  first           The index offset within the workspace for the first array
   * @param {Number}  maxfirst        The index offset within the workspace for the maxfirst array
   * @param {Number}  prevleaf        The index offset within the workspace for the prevleaf array
   * @param {Number}  ancestor        The index offset within the workspace for the ancestor array
   *
   * @return {Object}
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_leaf = function (i, j, w, first, maxfirst, prevleaf, ancestor) {
    
    var s, sparent, jprev;
    
    // our result
    var jleaf = 0;
    var q;
    
    // check j is a leaf
    if (i <= j || w[first + j] <= w[maxfirst + i]) 
      return (-1);
    // update max first[j] seen so far
    w[maxfirst + i] = w[first + j];
    // jprev = previous leaf of ith subtree
    jprev = w[prevleaf + i];
    w[prevleaf + i] = j;
    
    // check j is first or subsequent leaf
    if (jprev === -1) {
      // 1st leaf, q = root of ith subtree
      jleaf = 1;
      q = i;
    }
    else {
      // update jleaf
      jleaf = 2;
      // q = least common ancester (jprev,j)
      for (q = jprev; q != w[ancestor + q]; q = w[ancestor + q]);
      for (s = jprev; s != q; s = sparent) {
        // path compression
        sparent = w[ancestor + s];
        w[ancestor + s] = q;
      }      
    }
    return {
      jleaf: jleaf,
      q: q
    };
  };

  return cs_leaf;
}

exports.name = 'cs_leaf';
exports.path = 'sparse';
exports.factory = factory;
