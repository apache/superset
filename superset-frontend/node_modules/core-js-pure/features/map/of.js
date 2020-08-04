'use strict';
require('../../modules/es.map');
require('../../modules/es.string.iterator');
require('../../modules/esnext.map.of');
require('../../modules/web.dom-collections.iterator');
var path = require('../../internals/path');

var Map = path.Map;
var mapOf = Map.of;

module.exports = function of() {
  return mapOf.apply(typeof this === 'function' ? this : Map, arguments);
};
