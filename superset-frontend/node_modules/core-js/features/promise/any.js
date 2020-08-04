'use strict';
require('../../modules/es.promise');
require('../../modules/esnext.aggregate-error');
require('../../modules/esnext.promise.any');
var path = require('../../internals/path');

var Promise = path.Promise;
var $any = Promise.any;

module.exports = function any(iterable) {
  return $any.call(typeof this === 'function' ? this : Promise, iterable);
};
