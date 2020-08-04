require('../../modules/es.string.split');
var wellKnownSymbol = require('../../internals/well-known-symbol');

var SPLIT = wellKnownSymbol('split');

module.exports = function (it, str, limit) {
  return RegExp.prototype[SPLIT].call(it, str, limit);
};
