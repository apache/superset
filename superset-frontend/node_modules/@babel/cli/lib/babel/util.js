"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.chmod = chmod;
exports.readdir = readdir;
exports.readdirForCompilable = readdirForCompilable;
exports.isCompilableExtension = isCompilableExtension;
exports.addSourceMappingUrl = addSourceMappingUrl;
exports.transform = transform;
exports.compile = compile;
exports.deleteDir = deleteDir;
exports.requireChokidar = requireChokidar;
exports.withExtension = withExtension;

function _fsReaddirRecursive() {
  const data = _interopRequireDefault(require("fs-readdir-recursive"));

  _fsReaddirRecursive = function () {
    return data;
  };

  return data;
}

function babel() {
  const data = _interopRequireWildcard(require("@babel/core"));

  babel = function () {
    return data;
  };

  return data;
}

function _includes() {
  const data = _interopRequireDefault(require("lodash/includes"));

  _includes = function () {
    return data;
  };

  return data;
}

function _path() {
  const data = _interopRequireDefault(require("path"));

  _path = function () {
    return data;
  };

  return data;
}

function _fs() {
  const data = _interopRequireDefault(require("fs"));

  _fs = function () {
    return data;
  };

  return data;
}

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function chmod(src, dest) {
  _fs().default.chmodSync(dest, _fs().default.statSync(src).mode);
}

function readdir(dirname, includeDotfiles, filter) {
  return (0, _fsReaddirRecursive().default)(dirname, (filename, _index, currentDirectory) => {
    const stat = _fs().default.statSync(_path().default.join(currentDirectory, filename));

    if (stat.isDirectory()) return true;
    return (includeDotfiles || filename[0] !== ".") && (!filter || filter(filename));
  });
}

function readdirForCompilable(dirname, includeDotfiles, altExts) {
  return readdir(dirname, includeDotfiles, function (filename) {
    return isCompilableExtension(filename, altExts);
  });
}

function isCompilableExtension(filename, altExts) {
  const exts = altExts || babel().DEFAULT_EXTENSIONS;

  const ext = _path().default.extname(filename);

  return (0, _includes().default)(exts, ext);
}

function addSourceMappingUrl(code, loc) {
  return code + "\n//# sourceMappingURL=" + _path().default.basename(loc);
}

const CALLER = {
  name: "@babel/cli"
};

function transform(filename, code, opts) {
  opts = Object.assign({}, opts, {
    caller: CALLER,
    filename
  });
  return new Promise((resolve, reject) => {
    babel().transform(code, opts, (err, result) => {
      if (err) reject(err);else resolve(result);
    });
  });
}

function compile(filename, opts) {
  opts = Object.assign({}, opts, {
    caller: CALLER
  });
  return new Promise((resolve, reject) => {
    babel().transformFile(filename, opts, (err, result) => {
      if (err) reject(err);else resolve(result);
    });
  });
}

function deleteDir(path) {
  if (_fs().default.existsSync(path)) {
    _fs().default.readdirSync(path).forEach(function (file) {
      const curPath = path + "/" + file;

      if (_fs().default.lstatSync(curPath).isDirectory()) {
        deleteDir(curPath);
      } else {
        _fs().default.unlinkSync(curPath);
      }
    });

    _fs().default.rmdirSync(path);
  }
}

process.on("uncaughtException", function (err) {
  console.error(err);
  process.exitCode = 1;
});

function requireChokidar() {
  try {
    return require("chokidar");
  } catch (err) {
    console.error("The optional dependency chokidar failed to install and is required for " + "--watch. Chokidar is likely not supported on your platform.");
    throw err;
  }
}

function withExtension(filename, ext = ".js") {
  const newBasename = _path().default.basename(filename, _path().default.extname(filename)) + ext;
  return _path().default.join(_path().default.dirname(filename), newBasename);
}