'use strict';
require('../../modules/es.string.iterator');
require('../../modules/es.weak-set');
require('../../modules/esnext.weak-set.from');
require('../../modules/web.dom-collections.iterator');
var path = require('../../internals/path');

var WeakSet = path.WeakSet;
var weakSetfrom = WeakSet.from;

module.exports = function from(source, mapFn, thisArg) {
  return weakSetfrom.call(typeof this === 'function' ? this : WeakSet, source, mapFn, thisArg);
};
