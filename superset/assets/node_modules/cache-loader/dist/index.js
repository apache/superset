'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/* eslint-disable
  import/order
*/
var fs = require('fs');
var path = require('path');
var async = require('neo-async');
var crypto = require('crypto');
var mkdirp = require('mkdirp');

var _require = require('loader-utils'),
    getOptions = _require.getOptions;

var validateOptions = require('schema-utils');

var pkg = require('../package.json');

var env = process.env.NODE_ENV || 'development';

var schema = require('./options.json');

var defaults = {
  cacheDirectory: path.resolve('.cache-loader'),
  cacheIdentifier: `cache-loader:${pkg.version} ${env}`,
  cacheKey,
  read,
  write
};

function loader() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, 'Cache Loader');

  var writeFn = options.write;


  var callback = this.async();
  var data = this.data;

  var dependencies = this.getDependencies().concat(this.loaders.map(function (l) {
    return l.path;
  }));
  var contextDependencies = this.getContextDependencies();

  // Should the file get cached?
  var cache = true;
  // this.fs can be undefined
  // e.g when using the thread-loader
  // fallback to the fs module
  var FS = this.fs || fs;
  var toDepDetails = function toDepDetails(dep, mapCallback) {
    FS.stat(dep, function (err, stats) {
      if (err) {
        mapCallback(err);
        return;
      }

      var mtime = stats.mtime.getTime();

      if (mtime / 1000 >= Math.floor(data.startTime / 1000)) {
        // Don't trust mtime.
        // File was changed while compiling
        // or it could be an inaccurate filesystem.
        cache = false;
      }

      mapCallback(null, {
        path: dep,
        mtime
      });
    });
  };

  async.parallel([function (cb) {
    return async.mapLimit(dependencies, 20, toDepDetails, cb);
  }, function (cb) {
    return async.mapLimit(contextDependencies, 20, toDepDetails, cb);
  }], function (err, taskResults) {
    if (err) {
      callback.apply(undefined, [null].concat(args));
      return;
    }
    if (!cache) {
      callback.apply(undefined, [null].concat(args));
      return;
    }

    var _taskResults = _slicedToArray(taskResults, 2),
        deps = _taskResults[0],
        contextDeps = _taskResults[1];

    writeFn(data.cacheKey, {
      remainingRequest: data.remainingRequest,
      dependencies: deps,
      contextDependencies: contextDeps,
      result: args
    }, function () {
      // ignore errors here
      callback.apply(undefined, [null].concat(args));
    });
  });
}

function pitch(remainingRequest, prevRequest, dataInput) {
  var _this = this;

  var options = Object.assign({}, defaults, getOptions(this));

  validateOptions(schema, options, 'Cache Loader (Pitch)');

  var readFn = options.read,
      cacheKeyFn = options.cacheKey;


  var callback = this.async();
  var data = dataInput;

  data.remainingRequest = remainingRequest;
  data.cacheKey = cacheKeyFn(options, remainingRequest);
  readFn(data.cacheKey, function (readErr, cacheData) {
    if (readErr) {
      callback();
      return;
    }
    if (cacheData.remainingRequest !== remainingRequest) {
      // in case of a hash conflict
      callback();
      return;
    }
    var FS = _this.fs || fs;
    async.each(cacheData.dependencies.concat(cacheData.contextDependencies), function (dep, eachCallback) {
      FS.stat(dep.path, function (statErr, stats) {
        if (statErr) {
          eachCallback(statErr);
          return;
        }
        if (stats.mtime.getTime() !== dep.mtime) {
          eachCallback(true);
          return;
        }
        eachCallback();
      });
    }, function (err) {
      if (err) {
        data.startTime = Date.now();
        callback();
        return;
      }
      cacheData.dependencies.forEach(function (dep) {
        return _this.addDependency(dep.path);
      });
      cacheData.contextDependencies.forEach(function (dep) {
        return _this.addContextDependency(dep.path);
      });
      callback.apply(undefined, [null].concat(_toConsumableArray(cacheData.result)));
    });
  });
}

function digest(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

var directories = new Set();

function write(key, data, callback) {
  var dirname = path.dirname(key);
  var content = JSON.stringify(data);

  if (directories.has(dirname)) {
    // for performance skip creating directory
    fs.writeFile(key, content, 'utf-8', callback);
  } else {
    mkdirp(dirname, function (mkdirErr) {
      if (mkdirErr) {
        callback(mkdirErr);
        return;
      }

      directories.add(dirname);

      fs.writeFile(key, content, 'utf-8', callback);
    });
  }
}

function read(key, callback) {
  fs.readFile(key, 'utf-8', function (err, content) {
    if (err) {
      callback(err);
      return;
    }

    try {
      var data = JSON.parse(content);
      callback(null, data);
    } catch (e) {
      callback(e);
    }
  });
}

function cacheKey(options, request) {
  var cacheIdentifier = options.cacheIdentifier,
      cacheDirectory = options.cacheDirectory;

  var hash = digest(`${cacheIdentifier}\n${request}`);

  return path.join(cacheDirectory, `${hash}.json`);
}

exports.default = loader;
exports.pitch = pitch;