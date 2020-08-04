'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var $some = require('../internals/async-iterator-iteration').some;

$({ target: 'AsyncIterator', proto: true, real: true }, {
  some: function some(fn) {
    return $some(this, fn);
  }
});
