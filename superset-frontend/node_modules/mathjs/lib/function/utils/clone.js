'use strict';

var object= require('../../utils/object');

function factory (type, config, load, typed) {
  /**
   * Clone an object.
   *
   * Syntax:
   *
   *     math.clone(x)
   *
   * Examples:
   *
   *    math.clone(3.5);                   // returns number 3.5
   *    math.clone(math.complex('2-4i'); // returns Complex 2 - 4i
   *    math.clone(math.unit(45, 'deg'));  // returns Unit 45 deg
   *    math.clone([[1, 2], [3, 4]]);      // returns Array [[1, 2], [3, 4]]
   *    math.clone("hello world");         // returns string "hello world"
   *
   * @param {*} x   Object to be cloned
   * @return {*} A clone of object x
   */
  var clone = typed('clone', {
    'any': object.clone
  });

  clone.toTex = undefined; // use default template

  return clone;
}

exports.name = 'clone';
exports.factory = factory;
