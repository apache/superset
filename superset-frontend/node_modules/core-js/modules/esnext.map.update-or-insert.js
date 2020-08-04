'use strict';
var $ = require('../internals/export');
var IS_PURE = require('../internals/is-pure');
var anObject = require('../internals/an-object');
var aFunction = require('../internals/a-function');

// `Set.prototype.updateOrInsert` method
// https://docs.google.com/presentation/d/1_xtrGSoN1-l2Q74eCXPHBbbrBHsVyqArWN0ebnW-pVQ/
$({ target: 'Map', proto: true, real: true, forced: IS_PURE }, {
  updateOrInsert: function updateOrInsert(key, onUpdate, onInsert) {
    var map = anObject(this);
    aFunction(onUpdate);
    aFunction(onInsert);
    var value = map.has(key) ? onUpdate(map.get(key)) : onInsert();
    map.set(key, value);
    return value;
  }
});
