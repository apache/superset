var padStart = require('../string/virtual/pad-start');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.padStart;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.padStart) ? padStart : own;
};
