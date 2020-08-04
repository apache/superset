var endsWith = require('../string/virtual/ends-with');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.endsWith;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.endsWith) ? endsWith : own;
};
