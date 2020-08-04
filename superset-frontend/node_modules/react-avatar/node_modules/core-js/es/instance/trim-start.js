var trimStart = require('../string/virtual/trim-start');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.trimStart;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.trimStart) ? trimStart : own;
};
