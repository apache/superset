'use strict';
var $ = require('../internals/export');
var IS_PURE = require('../internals/is-pure');
var $upsert = require('../internals/map-upsert');

// `Map.prototype.upsert` method
// https://github.com/thumbsupep/proposal-upsert
$({ target: 'Map', proto: true, real: true, forced: IS_PURE }, {
  upsert: $upsert
});
