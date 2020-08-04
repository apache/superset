require('../../modules/es.string.match');
var wellKnownSymbol = require('../../internals/well-known-symbol');

var MATCH = wellKnownSymbol('match');

module.exports = function (it, str) {
  return RegExp.prototype[MATCH].call(it, str);
};
