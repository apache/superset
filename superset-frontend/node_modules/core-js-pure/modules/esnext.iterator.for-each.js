'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var iterate = require('../internals/iterate');
var anObject = require('../internals/an-object');

$({ target: 'Iterator', proto: true, real: true }, {
  forEach: function forEach(fn) {
    iterate(anObject(this), fn, undefined, false, true);
  }
});
