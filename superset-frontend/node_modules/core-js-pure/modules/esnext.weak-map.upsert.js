'use strict';
var $ = require('../internals/export');
var IS_PURE = require('../internals/is-pure');
var $upsert = require('../internals/map-upsert');

// `WeakMap.prototype.upsert` method
// https://github.com/thumbsupep/proposal-upsert
$({ target: 'WeakMap', proto: true, real: true, forced: IS_PURE }, {
  upsert: $upsert
});
