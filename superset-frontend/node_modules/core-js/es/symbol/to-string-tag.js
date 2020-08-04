require('../../modules/es.symbol.to-string-tag');
require('../../modules/es.object.to-string');
require('../../modules/es.math.to-string-tag');
require('../../modules/es.json.to-string-tag');
var WrappedWellKnownSymbolModule = require('../../internals/wrapped-well-known-symbol');

module.exports = WrappedWellKnownSymbolModule.f('toStringTag');
