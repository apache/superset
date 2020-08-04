require('../../modules/es.string.search');
var wellKnownSymbol = require('../../internals/well-known-symbol');

var SEARCH = wellKnownSymbol('search');

module.exports = function (it, str) {
  return RegExp.prototype[SEARCH].call(it, str);
};
