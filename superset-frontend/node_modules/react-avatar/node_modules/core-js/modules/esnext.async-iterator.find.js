'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var $find = require('../internals/async-iterator-iteration').find;

$({ target: 'AsyncIterator', proto: true, real: true }, {
  find: function find(fn) {
    return $find(this, fn);
  }
});
