var trimRight = require('../string/virtual/trim-right');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.trimRight;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.trimRight) ? trimRight : own;
};
