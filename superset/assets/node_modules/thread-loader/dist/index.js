'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.warmup = exports.pitch = undefined;

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

var _workerPools = require('./workerPools');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function pitch() {
  var _this = this;

  var options = _loaderUtils2.default.getOptions(this) || {};
  var workerPool = (0, _workerPools.getPool)(options);
  var callback = this.async();
  workerPool.run({
    loaders: this.loaders.slice(this.loaderIndex + 1).map(function (l) {
      return {
        loader: l.path,
        options: l.options,
        ident: l.ident
      };
    }),
    resource: this.resourcePath + (this.resourceQuery || ''),
    sourceMap: this.sourceMap,
    emitError: this.emitError,
    emitWarning: this.emitWarning,
    resolve: this.resolve,
    target: this.target,
    minimize: this.minimize,
    resourceQuery: this.resourceQuery,
    optionsContext: this.rootContext || this.options.context
  }, function (err, r) {
    if (r) {
      r.fileDependencies.forEach(function (d) {
        return _this.addDependency(d);
      });
      r.contextDependencies.forEach(function (d) {
        return _this.addContextDependency(d);
      });
    }
    if (err) {
      callback(err);
      return;
    }
    callback.apply(undefined, [null].concat(_toConsumableArray(r.result)));
  });
}

function warmup(options, requires) {
  var workerPool = (0, _workerPools.getPool)(options);
  workerPool.warmup(requires);
}

exports.pitch = pitch;
exports.warmup = warmup; // eslint-disable-line import/prefer-default-export