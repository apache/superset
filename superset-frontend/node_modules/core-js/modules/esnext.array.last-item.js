'use strict';
var DESCRIPTORS = require('../internals/descriptors');
var addToUnscopables = require('../internals/add-to-unscopables');
var toObject = require('../internals/to-object');
var toLength = require('../internals/to-length');
var defineProperty = require('../internals/object-define-property').f;

// `Array.prototype.lastIndex` accessor
// https://github.com/keithamus/proposal-array-last
if (DESCRIPTORS && !('lastItem' in [])) {
  defineProperty(Array.prototype, 'lastItem', {
    configurable: true,
    get: function lastItem() {
      var O = toObject(this);
      var len = toLength(O.length);
      return len == 0 ? undefined : O[len - 1];
    },
    set: function lastItem(value) {
      var O = toObject(this);
      var len = toLength(O.length);
      return O[len == 0 ? 0 : len - 1] = value;
    }
  });

  addToUnscopables('lastItem');
}
