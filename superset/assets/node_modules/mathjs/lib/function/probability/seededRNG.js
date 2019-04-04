'use strict';

var seedrandom = require('seed-random');

// create a random seed here to prevent an infinite loop from seed-random
// inside the factory. Reason is that math.random is defined as a getter/setter
// and seed-random generates a seed from the local entropy by reading every
// defined object including `math` itself. That means that whilst getting
// math.random, it tries to get math.random, etc... an infinite loop.
// See https://github.com/ForbesLindesay/seed-random/issues/6
var singletonRandom = seedrandom();

function factory (type, config, load, typed, math) {
  var random;

  // create a new random generator with given seed
  function setSeed (seed) {
    random = seed === null ? singletonRandom : seedrandom(String(seed));
  }

  // initialize a seeded pseudo random number generator with config's random seed
  setSeed(config.randomSeed)

  // wrapper function so the rng can be updated via generator
  function rng() {
      return random();
  }

  // updates generator with a new instance of a seeded pseudo random number generator
  math.on('config', function (curr, prev, changes) {
    // if the user specified a randomSeed
    if(changes.randomSeed !== undefined) {
      // update generator with a new instance of a seeded pseudo random number generator
      setSeed(curr.randomSeed)
    }
  });

  return rng;
}

exports.factory = factory;
exports.math = true;
