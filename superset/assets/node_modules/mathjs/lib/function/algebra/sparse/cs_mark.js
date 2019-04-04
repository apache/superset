'use strict';

function factory (type, config, load) {

  var cs_flip = load(require('./cs_flip'));

  /**
   * Marks the node at w[j]
   *
   * @param {Array}   w               The array
   * @param {Number}  j               The array index
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_mark = function (w, j) {
    // mark w[j]
    w[j] = cs_flip(w [j]);
  };

  return cs_mark;
}

exports.name = 'cs_mark';
exports.path = 'sparse';
exports.factory = factory;
