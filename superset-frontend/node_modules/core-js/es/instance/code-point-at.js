var codePointAt = require('../string/virtual/code-point-at');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.codePointAt;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.codePointAt) ? codePointAt : own;
};
