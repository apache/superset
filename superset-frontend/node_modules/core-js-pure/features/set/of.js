'use strict';
require('../../modules/es.set');
require('../../modules/es.string.iterator');
require('../../modules/esnext.set.of');
require('../../modules/web.dom-collections.iterator');
var path = require('../../internals/path');

var Set = path.Set;
var setOf = Set.of;

module.exports = function of() {
  return setOf.apply(typeof this === 'function' ? this : Set, arguments);
};
