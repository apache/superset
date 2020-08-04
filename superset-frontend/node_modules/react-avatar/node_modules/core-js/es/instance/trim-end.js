var trimEnd = require('../string/virtual/trim-end');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.trimEnd;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.trimEnd) ? trimEnd : own;
};
