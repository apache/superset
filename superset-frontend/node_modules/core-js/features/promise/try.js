'use strict';
require('../../modules/es.promise');
require('../../modules/esnext.promise.try');
var path = require('../../internals/path');

var Promise = path.Promise;
var promiseTry = Promise['try'];

module.exports = { 'try': function (callbackfn) {
  return promiseTry.call(typeof this === 'function' ? this : Promise, callbackfn);
} }['try'];
