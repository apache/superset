'use strict';
require('../../modules/es.string.iterator');
require('../../modules/es.weak-set');
require('../../modules/esnext.weak-set.of');
require('../../modules/web.dom-collections.iterator');
var path = require('../../internals/path');

var WeakSet = path.WeakSet;
var weakSetOf = WeakSet.of;

module.exports = function of() {
  return weakSetOf.apply(typeof this === 'function' ? this : WeakSet, arguments);
};
