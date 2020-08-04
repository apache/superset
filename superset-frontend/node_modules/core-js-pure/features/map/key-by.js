'use strict';
require('../../modules/es.map');
require('../../modules/esnext.map.key-by');
var path = require('../../internals/path');

var Map = path.Map;
var mapKeyBy = Map.keyBy;

module.exports = function keyBy(source, iterable, keyDerivative) {
  return mapKeyBy.call(typeof this === 'function' ? this : Map, source, iterable, keyDerivative);
};
