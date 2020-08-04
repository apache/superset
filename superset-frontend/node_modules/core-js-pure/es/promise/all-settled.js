'use strict';
require('../../modules/es.promise');
require('../../modules/es.promise.all-settled');
var path = require('../../internals/path');

var Promise = path.Promise;
var $allSettled = Promise.allSettled;

module.exports = function allSettled(iterable) {
  return $allSettled.call(typeof this === 'function' ? this : Promise, iterable);
};
