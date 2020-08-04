"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.save = save;
exports.load = load;
exports.get = get;
exports.clear = clear;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _os = _interopRequireDefault(require("os"));

var _makeDir = require("make-dir");

var babel = _interopRequireWildcard(require("@babel/core"));

var _findCacheDir = _interopRequireDefault(require("find-cache-dir"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_CACHE_DIR = (0, _findCacheDir.default)({
  name: "@babel/register"
}) || _os.default.homedir() || _os.default.tmpdir();

const DEFAULT_FILENAME = _path.default.join(DEFAULT_CACHE_DIR, `.babel.${babel.version}.${babel.getEnv()}.json`);

const FILENAME = process.env.BABEL_CACHE_PATH || DEFAULT_FILENAME;
let data = {};
let cacheDisabled = false;

function isCacheDisabled() {
  var _process$env$BABEL_DI;

  return (_process$env$BABEL_DI = process.env.BABEL_DISABLE_CACHE) != null ? _process$env$BABEL_DI : cacheDisabled;
}

function save() {
  if (isCacheDisabled()) return;
  let serialised = "{}";

  try {
    serialised = JSON.stringify(data, null, "  ");
  } catch (err) {
    if (err.message === "Invalid string length") {
      err.message = "Cache too large so it's been cleared.";
      console.error(err.stack);
    } else {
      throw err;
    }
  }

  try {
    (0, _makeDir.sync)(_path.default.dirname(FILENAME));

    _fs.default.writeFileSync(FILENAME, serialised);
  } catch (e) {
    switch (e.code) {
      case "ENOENT":
      case "EACCES":
      case "EPERM":
        console.warn(`Babel could not write cache to file: ${FILENAME} 
due to a permission issue. Cache is disabled.`);
        cacheDisabled = true;
        break;

      case "EROFS":
        console.warn(`Babel could not write cache to file: ${FILENAME} 
because it resides in a readonly filesystem. Cache is disabled.`);
        cacheDisabled = true;
        break;

      default:
        throw e;
    }
  }
}

function load() {
  if (isCacheDisabled()) {
    data = {};
    return;
  }

  process.on("exit", save);
  process.nextTick(save);
  let cacheContent;

  try {
    cacheContent = _fs.default.readFileSync(FILENAME);
  } catch (e) {
    switch (e.code) {
      case "EACCES":
        console.warn(`Babel could not read cache file: ${FILENAME}
due to a permission issue. Cache is disabled.`);
        cacheDisabled = true;

      default:
        return;
    }
  }

  try {
    data = JSON.parse(cacheContent);
  } catch (_unused) {}
}

function get() {
  return data;
}

function clear() {
  data = {};
}