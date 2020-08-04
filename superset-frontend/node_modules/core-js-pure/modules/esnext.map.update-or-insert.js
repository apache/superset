'use strict';
// TODO: remove from `core-js@4`
var $ = require('../internals/export');
var IS_PURE = require('../internals/is-pure');
var $upsert = require('../internals/map-upsert');

// `Map.prototype.updateOrInsert` method (replaced by `Map.prototype.upsert`)
// https://github.com/thumbsupep/proposal-upsert
$({ target: 'Map', proto: true, real: true, forced: IS_PURE }, {
  updateOrInsert: $upsert
});
