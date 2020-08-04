'use strict';

function factory () {

  /**
   * Depth-first search and postorder of a tree rooted at node j
   *
   * @param {Number}  j               The tree node
   * @param {Number}  k               
   * @param {Array}   w               The workspace array
   * @param {Number}  head            The index offset within the workspace for the head array
   * @param {Number}  next            The index offset within the workspace for the next array
   * @param {Array}   post            The post ordering array
   * @param {Number}  stack           The index offset within the workspace for the stack array
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_tdfs = function (j, k, w, head, next, post, stack) {
    // variables
    var top = 0;
    // place j on the stack
    w[stack] = j;
    // while (stack is not empty) 
    while (top >= 0) {
      // p = top of stack
      var p = w[stack + top];
      // i = youngest child of p
      var i = w[head + p];
      if (i == -1) {
        // p has no unordered children left
        top--;
        // node p is the kth postordered node
        post[k++] = p;
      }
      else {
        // remove i from children of p
        w[head + p] = w[next + i];
        // increment top
        ++top;
        // start dfs on child node i
        w[stack + top] = i;
      }
    }
    return k;
  };

  return cs_tdfs;
}

exports.name = 'cs_tdfs';
exports.path = 'sparse';
exports.factory = factory;
