var codePoints = require('../string/virtual/code-points');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.codePoints;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.codePoints) ? codePoints : own;
};
