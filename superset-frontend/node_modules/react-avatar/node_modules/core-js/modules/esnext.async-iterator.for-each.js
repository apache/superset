'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var $forEach = require('../internals/async-iterator-iteration').forEach;

$({ target: 'AsyncIterator', proto: true, real: true }, {
  forEach: function forEach(fn) {
    return $forEach(this, fn);
  }
});
