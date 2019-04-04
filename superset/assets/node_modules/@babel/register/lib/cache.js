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

var _mkdirp = require("mkdirp");

var _homeOrTmp = _interopRequireDefault(require("home-or-tmp"));

var babel = _interopRequireWildcard(require("@babel/core"));

var _findCacheDir = _interopRequireDefault(require("find-cache-dir"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_CACHE_DIR = (0, _findCacheDir.default)({
  name: "@babel/register"
}) || _homeOrTmp.default;

const DEFAULT_FILENAME = _path.default.join(DEFAULT_CACHE_DIR, `.babel.${babel.version}.${babel.getEnv()}.json`);

const FILENAME = process.env.BABEL_CACHE_PATH || DEFAULT_FILENAME;
let data = {};

function save() {
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

  (0, _mkdirp.sync)(_path.default.dirname(FILENAME));

  _fs.default.writeFileSync(FILENAME, serialised);
}

function load() {
  if (process.env.BABEL_DISABLE_CACHE) return;
  process.on("exit", save);
  process.nextTick(save);
  if (!_fs.default.existsSync(FILENAME)) return;

  try {
    data = JSON.parse(_fs.default.readFileSync(FILENAME));
  } catch (err) {
    return;
  }
}

function get() {
  return data;
}

function clear() {
  data = {};
}