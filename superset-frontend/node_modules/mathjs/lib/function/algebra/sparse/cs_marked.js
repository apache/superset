'use strict';

function factory () {

  /**
   * Checks if the node at w[j] is marked
   *
   * @param {Array}   w               The array
   * @param {Number}  j               The array index
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_marked = function (w, j) {
    // check node is marked
    return w[j] < 0;
  };

  return cs_marked;
}

exports.name = 'cs_marked';
exports.path = 'sparse';
exports.factory = factory;
