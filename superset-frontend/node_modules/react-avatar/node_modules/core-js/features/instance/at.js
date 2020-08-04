var at = require('../string/virtual/at');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.at;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.at) ? at : own;
};
