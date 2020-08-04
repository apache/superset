'use strict';
var $ = require('../internals/export');
var ObjectIterator = require('../internals/object-iterator');

// `Object.iterateKeys` method
// https://github.com/tc39/proposal-object-iteration
$({ target: 'Object', stat: true }, {
  iterateKeys: function iterateKeys(object) {
    return new ObjectIterator(object, 'keys');
  }
});
