var isArray = require('./internals/is-array');
var isForced = require('./internals/is-forced');
var data = isForced.data;
var normalize = isForced.normalize;

var setAggressivenessLevel = function (object, constant) {
  if (isArray(object)) for (var i = 0; i < object.length; i++) data[normalize(object[i])] = constant;
};

module.exports = function (options) {
  if (typeof options == 'object') {
    setAggressivenessLevel(options.useNative, isForced.NATIVE);
    setAggressivenessLevel(options.usePolyfill, isForced.POLYFILL);
    setAggressivenessLevel(options.useFeatureDetection, null);
  }
};
