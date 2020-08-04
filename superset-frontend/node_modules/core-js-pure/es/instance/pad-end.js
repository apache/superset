var padEnd = require('../string/virtual/pad-end');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.padEnd;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.padEnd) ? padEnd : own;
};
