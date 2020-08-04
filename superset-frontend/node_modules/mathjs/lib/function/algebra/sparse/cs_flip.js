'use strict';

function factory () {

  /**
   * This function "flips" its input about the integer -1.
   *
   * @param {Number}  i               The value to flip
   *
   * Reference: http://faculty.cse.tamu.edu/davis/publications.html
   */
  var cs_flip = function (i) {
    // flip the value
    return -i - 2;
  };

  return cs_flip;
}

exports.name = 'cs_flip';
exports.path = 'sparse';
exports.factory = factory;
