'use strict';
// https://github.com/tc39/proposal-iterator-helpers
var $ = require('../internals/export');
var iterate = require('../internals/iterate');
var aFunction = require('../internals/a-function');
var anObject = require('../internals/an-object');

$({ target: 'Iterator', proto: true, real: true }, {
  find: function find(fn) {
    anObject(this);
    aFunction(fn);
    return iterate(this, function (value) {
      if (fn(value)) return iterate.stop(value);
    }, undefined, false, true).result;
  }
});
