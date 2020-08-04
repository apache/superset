var trimLeft = require('../string/virtual/trim-left');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.trimLeft;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.trimLeft) ? trimLeft : own;
};
