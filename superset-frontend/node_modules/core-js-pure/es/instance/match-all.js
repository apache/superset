var matchAll = require('../string/virtual/match-all');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.matchAll;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.matchAll) ? matchAll : own;
};
