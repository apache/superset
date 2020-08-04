'use strict';

function factory (type, config, load, typed) {
  var distribution = load(require('./distribution'));

  /**
   * Return a random number larger or equal to `min` and smaller than `max`
   * using a uniform distribution.
   *
   * Syntax:
   *
   *     math.random()                // generate a random number between 0 and 1
   *     math.random(max)             // generate a random number between 0 and max
   *     math.random(min, max)        // generate a random number between min and max
   *     math.random(size)            // generate a matrix with random numbers between 0 and 1
   *     math.random(size, max)       // generate a matrix with random numbers between 0 and max
   *     math.random(size, min, max)  // generate a matrix with random numbers between min and max
   *
   * Examples:
   *
   *     math.random();       // returns a random number between 0 and 1
   *     math.random(100);    // returns a random number between 0 and 100
   *     math.random(30, 40); // returns a random number between 30 and 40
   *     math.random([2, 3]); // returns a 2x3 matrix with random numbers between 0 and 1
   *
   * See also:
   *
   *     randomInt, pickRandom
   *
   * @param {Array | Matrix} [size] If provided, an array or matrix with given
   *                                size and filled with random values is returned
   * @param {number} [min]  Minimum boundary for the random value, included
   * @param {number} [max]  Maximum boundary for the random value, excluded
   * @return {number | Array | Matrix} A random number
   */
  // TODO: rework random to a typed-function
  var random = distribution('uniform').random;

  random.toTex = undefined; // use default template

  return random;
}

exports.name = 'random';
exports.factory = factory;
