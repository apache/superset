'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var $every = require('../internals/async-iterator-iteration').every;

$({ target: 'AsyncIterator', proto: true, real: true }, {
  every: function every(fn) {
    return $every(this, fn);
  }
});
