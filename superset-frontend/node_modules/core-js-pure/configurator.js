var has = require('./internals/has');
var isArray = require('./internals/is-array');
var isForced = require('./internals/is-forced');
var shared = require('./internals/shared-store');

var data = isForced.data;
var normalize = isForced.normalize;
var USE_FUNCTION_CONSTRUCTOR = 'USE_FUNCTION_CONSTRUCTOR';
var ASYNC_ITERATOR_PROTOTYPE = 'AsyncIteratorPrototype';

var setAggressivenessLevel = function (object, constant) {
  if (isArray(object)) for (var i = 0; i < object.length; i++) data[normalize(object[i])] = constant;
};

module.exports = function (options) {
  if (typeof options == 'object') {
    setAggressivenessLevel(options.useNative, isForced.NATIVE);
    setAggressivenessLevel(options.usePolyfill, isForced.POLYFILL);
    setAggressivenessLevel(options.useFeatureDetection, null);
    if (has(options, USE_FUNCTION_CONSTRUCTOR)) shared[USE_FUNCTION_CONSTRUCTOR] = !!options[USE_FUNCTION_CONSTRUCTOR];
    if (has(options, ASYNC_ITERATOR_PROTOTYPE)) shared[USE_FUNCTION_CONSTRUCTOR] = options[ASYNC_ITERATOR_PROTOTYPE];
  }
};
