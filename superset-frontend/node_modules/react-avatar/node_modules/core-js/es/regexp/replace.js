require('../../modules/es.string.replace');
var wellKnownSymbol = require('../../internals/well-known-symbol');

var REPLACE = wellKnownSymbol('replace');

module.exports = function (it, str, replacer) {
  return RegExp.prototype[REPLACE].call(it, str, replacer);
};
