'use strict';
var $ = require('../internals/export');
var ObjectIterator = require('../internals/object-iterator');

// `Object.iterateValues` method
// https://github.com/tc39/proposal-object-iteration
$({ target: 'Object', stat: true }, {
  iterateValues: function iterateValues(object) {
    return new ObjectIterator(object, 'values');
  }
});
