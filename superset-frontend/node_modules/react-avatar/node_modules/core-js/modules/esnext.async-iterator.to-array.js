'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var $toArray = require('../internals/async-iterator-iteration').toArray;

$({ target: 'AsyncIterator', proto: true, real: true }, {
  toArray: function toArray() {
    return $toArray(this);
  }
});
