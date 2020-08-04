'use strict';
require('../../modules/es.map');
require('../../modules/esnext.map.group-by');
var path = require('../../internals/path');

var Map = path.Map;
var mapGroupBy = Map.groupBy;

module.exports = function groupBy(source, iterable, keyDerivative) {
  return mapGroupBy.call(typeof this === 'function' ? this : Map, source, iterable, keyDerivative);
};
