'use strict';

function factory (type, config, load, typed) {
  var distribution = load(require('./distribution'));

  /**
   * Random pick one or more values from a one dimensional array.
   * Array elements are picked using a random function with uniform or weighted distribution.
   *
   * Syntax:
   *
   *     math.pickRandom(array)
   *     math.pickRandom(array, number)
   *     math.pickRandom(array, weights)
   *     math.pickRandom(array, number, weights)
   *     math.pickRandom(array, weights, number)
   *
   * Examples:
   *
   *     math.pickRandom([3, 6, 12, 2]);                  // returns one of the values in the array
   *     math.pickRandom([3, 6, 12, 2], 2);               // returns an array of two of the values in the array
   *     math.pickRandom([3, 6, 12, 2], [1, 3, 2, 1]);    // returns one of the values in the array with weighted distribution
   *     math.pickRandom([3, 6, 12, 2], 2, [1, 3, 2, 1]); // returns an array of two of the values in the array with weighted distribution
   *     math.pickRandom([3, 6, 12, 2], [1, 3, 2, 1], 2); // returns an array of two of the values in the array with weighted distribution
   *
   * See also:
   *
   *     random, randomInt
   *
   * @param {Array} array     A one dimensional array
   * @param {Int} number      An int or float
   * @param {Array} weights   An array of ints or floats
   * @return {number | Array} Returns a single random value from array when number is 1 or undefined.
   *                          Returns an array with the configured number of elements when number is > 1.
   */
  // TODO: rework pickRandom to a typed-function
  var pickRandom =  distribution('uniform').pickRandom;

  pickRandom.toTex = undefined; // use default template

  return pickRandom;
}

exports.name = 'pickRandom';
exports.factory = factory;
