var repeat = require('../string/virtual/repeat');

var StringPrototype = String.prototype;

module.exports = function (it) {
  var own = it.repeat;
  return typeof it === 'string' || it === StringPrototype
    || (it instanceof String && own === StringPrototype.repeat) ? repeat : own;
};
