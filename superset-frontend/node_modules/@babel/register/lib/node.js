"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.revert = revert;
exports.default = register;

var _cloneDeep = _interopRequireDefault(require("lodash/cloneDeep"));

var _sourceMapSupport = _interopRequireDefault(require("source-map-support"));

var registerCache = _interopRequireWildcard(require("./cache"));

var _escapeRegExp = _interopRequireDefault(require("lodash/escapeRegExp"));

var babel = _interopRequireWildcard(require("@babel/core"));

var _pirates = require("pirates");

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const maps = {};
let transformOpts = {};
let piratesRevert = null;

function installSourceMapSupport() {
  _sourceMapSupport.default.install({
    handleUncaughtExceptions: false,
    environment: "node",

    retrieveSourceMap(source) {
      const map = maps && maps[source];

      if (map) {
        return {
          url: null,
          map: map
        };
      } else {
        return null;
      }
    }

  });
}

let cache;

function mtime(filename) {
  return +_fs.default.statSync(filename).mtime;
}

function compile(code, filename) {
  const opts = new babel.OptionManager().init(Object.assign({
    sourceRoot: _path.default.dirname(filename)
  }, (0, _cloneDeep.default)(transformOpts), {
    filename
  }));
  if (opts === null) return code;
  let cacheKey = `${JSON.stringify(opts)}:${babel.version}`;
  const env = babel.getEnv(false);
  if (env) cacheKey += `:${env}`;
  let cached = cache && cache[cacheKey];

  if (!cached || cached.mtime !== mtime(filename)) {
    cached = babel.transform(code, Object.assign({}, opts, {
      sourceMaps: opts.sourceMaps === undefined ? "both" : opts.sourceMaps,
      ast: false
    }));

    if (cache) {
      cache[cacheKey] = cached;
      cached.mtime = mtime(filename);
    }
  }

  if (cached.map) {
    if (Object.keys(maps).length === 0) {
      installSourceMapSupport();
    }

    maps[filename] = cached.map;
  }

  return cached.code;
}

let compiling = false;

function compileHook(code, filename) {
  if (compiling) return code;

  try {
    compiling = true;
    return compile(code, filename);
  } finally {
    compiling = false;
  }
}

function hookExtensions(exts) {
  if (piratesRevert) piratesRevert();
  piratesRevert = (0, _pirates.addHook)(compileHook, {
    exts,
    ignoreNodeModules: false
  });
}

function revert() {
  if (piratesRevert) piratesRevert();
}

register();

function register(opts = {}) {
  opts = Object.assign({}, opts);
  hookExtensions(opts.extensions || babel.DEFAULT_EXTENSIONS);

  if (opts.cache === false && cache) {
    registerCache.clear();
    cache = null;
  } else if (opts.cache !== false && !cache) {
    registerCache.load();
    cache = registerCache.get();
  }

  delete opts.extensions;
  delete opts.cache;
  transformOpts = Object.assign({}, opts, {
    caller: Object.assign({
      name: "@babel/register"
    }, opts.caller || {})
  });
  let {
    cwd = "."
  } = transformOpts;
  cwd = transformOpts.cwd = _path.default.resolve(cwd);

  if (transformOpts.ignore === undefined && transformOpts.only === undefined) {
    transformOpts.only = [new RegExp("^" + (0, _escapeRegExp.default)(cwd), "i")];
    transformOpts.ignore = [new RegExp("^" + (0, _escapeRegExp.default)(cwd) + "(?:" + _path.default.sep + ".*)?" + (0, _escapeRegExp.default)(_path.default.sep + "node_modules" + _path.default.sep), "i")];
  }
}