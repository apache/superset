'use strict';

var flatten = require('../../utils/array').flatten;

function factory (type, config, load, typed) {

  /**
  * Computes the mode of a set of numbers or a list with values(numbers or characters).
  * If there are more than one modes, it returns a list of those values.
  *
  * Syntax:
  *
  *     math.mode(a, b, c, ...)
  *     math.mode(A)
  *
  * Examples:
  *
  *     math.mode(2, 1, 4, 3, 1);                            // returns [1]
  *     math.mode([1, 2.7, 3.2, 4, 2.7]);                    // returns [2.7]
  *     math.mode(1, 4, 6, 1, 6)                             // returns [1, 6]
  *     math.mode('a','a','b','c')                           // returns ["a"]
  *     math.mode(1, 1.5, 'abc')                             // returns [1, 1.5, "abc"]
  *
  * See also:
  *
  *     median,
  *     mean
  *
  * @param {... *} args  A single matrix
  * @return {*} The mode of all values
  */

  var mode = typed('mode', {
    'Array | Matrix' : _mode,
    
    '...': function (args) {
      return _mode(args);
    }
  });
  
  return mode;

  /**
   * Calculates the mode in an 1-dimensional array
   * @param {Array} values
   * @return {number} mode
   * @private
   */
  function _mode(values) {
    values = flatten(values.valueOf());
    var num = values.length;
    if (num == 0) {
      throw new Error('Cannot calculate mode of an empty array');
    }
    
    var count = {},
        mode = [],
        max = 0;
    for (var i in values) {
      if (!(values[i] in count)){
        count[values[i]] = 0;
      }
      count[values[i]]++;
      if (count[values[i]] == max){
        mode.push(values[i]);
      }
      else if (count[values[i]] > max) {
        max = count[values[i]];
        mode = [values[i]];
      }
    }
    return mode; 
  };
}

exports.name = 'mode';
exports.factory = factory;