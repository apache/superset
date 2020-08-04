'use strict';
require('../../modules/es.string.iterator');
require('../../modules/es.weak-map');
require('../../modules/esnext.weak-map.of');
require('../../modules/web.dom-collections.iterator');
var path = require('../../internals/path');

var WeakMap = path.WeakMap;
var weakMapOf = WeakMap.of;

module.exports = function of() {
  return weakMapOf.apply(typeof this === 'function' ? this : WeakMap, arguments);
};
