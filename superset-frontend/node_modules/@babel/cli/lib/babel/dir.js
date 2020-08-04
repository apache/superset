"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _defaults() {
  const data = _interopRequireDefault(require("lodash/defaults"));

  _defaults = function () {
    return data;
  };

  return data;
}

function _makeDir() {
  const data = require("make-dir");

  _makeDir = function () {
    return data;
  };

  return data;
}

function _slash() {
  const data = _interopRequireDefault(require("slash"));

  _slash = function () {
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

var util = _interopRequireWildcard(require("./util"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

const FILE_TYPE = Object.freeze({
  NON_COMPILABLE: "NON_COMPILABLE",
  COMPILED: "COMPILED",
  IGNORED: "IGNORED",
  ERR_COMPILATION: "ERR_COMPILATION"
});

function outputFileSync(filePath, data) {
  (0, _makeDir().sync)(_path().default.dirname(filePath));

  _fs().default.writeFileSync(filePath, data);
}

function _default(_x) {
  return _ref.apply(this, arguments);
}

function _ref() {
  _ref = _asyncToGenerator(function* ({
    cliOptions,
    babelOptions
  }) {
    const filenames = cliOptions.filenames;

    function write(_x2, _x3) {
      return _write.apply(this, arguments);
    }

    function _write() {
      _write = _asyncToGenerator(function* (src, base) {
        let relative = _path().default.relative(base, src);

        if (!util.isCompilableExtension(relative, cliOptions.extensions)) {
          return FILE_TYPE.NON_COMPILABLE;
        }

        relative = util.withExtension(relative, cliOptions.keepFileExtension ? _path().default.extname(relative) : cliOptions.outFileExtension);
        const dest = getDest(relative, base);

        try {
          const res = yield util.compile(src, (0, _defaults().default)({
            sourceFileName: (0, _slash().default)(_path().default.relative(dest + "/..", src))
          }, babelOptions));
          if (!res) return FILE_TYPE.IGNORED;

          if (res.map && babelOptions.sourceMaps && babelOptions.sourceMaps !== "inline") {
            const mapLoc = dest + ".map";
            res.code = util.addSourceMappingUrl(res.code, mapLoc);
            res.map.file = _path().default.basename(relative);
            outputFileSync(mapLoc, JSON.stringify(res.map));
          }

          outputFileSync(dest, res.code);
          util.chmod(src, dest);

          if (cliOptions.verbose) {
            console.log(src + " -> " + dest);
          }

          return FILE_TYPE.COMPILED;
        } catch (err) {
          if (cliOptions.watch) {
            console.error(err);
            return FILE_TYPE.ERR_COMPILATION;
          }

          throw err;
        }
      });
      return _write.apply(this, arguments);
    }

    function getDest(filename, base) {
      if (cliOptions.relative) {
        return _path().default.join(base, cliOptions.outDir, filename);
      }

      return _path().default.join(cliOptions.outDir, filename);
    }

    function handleFile(_x4, _x5) {
      return _handleFile.apply(this, arguments);
    }

    function _handleFile() {
      _handleFile = _asyncToGenerator(function* (src, base) {
        const written = yield write(src, base);

        if (cliOptions.copyFiles && written === FILE_TYPE.NON_COMPILABLE || cliOptions.copyIgnored && written === FILE_TYPE.IGNORED) {
          const filename = _path().default.relative(base, src);

          const dest = getDest(filename, base);
          outputFileSync(dest, _fs().default.readFileSync(src));
          util.chmod(src, dest);
        }

        return written === FILE_TYPE.COMPILED;
      });
      return _handleFile.apply(this, arguments);
    }

    function handle(_x6) {
      return _handle.apply(this, arguments);
    }

    function _handle() {
      _handle = _asyncToGenerator(function* (filenameOrDir) {
        if (!_fs().default.existsSync(filenameOrDir)) return 0;

        const stat = _fs().default.statSync(filenameOrDir);

        if (stat.isDirectory()) {
          const dirname = filenameOrDir;
          let count = 0;
          const files = util.readdir(dirname, cliOptions.includeDotfiles);

          for (const filename of files) {
            const src = _path().default.join(dirname, filename);

            const written = yield handleFile(src, dirname);
            if (written) count += 1;
          }

          return count;
        } else {
          const filename = filenameOrDir;
          const written = yield handleFile(filename, _path().default.dirname(filename));
          return written ? 1 : 0;
        }
      });
      return _handle.apply(this, arguments);
    }

    if (!cliOptions.skipInitialBuild) {
      if (cliOptions.deleteDirOnStart) {
        util.deleteDir(cliOptions.outDir);
      }

      (0, _makeDir().sync)(cliOptions.outDir);
      let compiledFiles = 0;

      for (const filename of cliOptions.filenames) {
        compiledFiles += yield handle(filename);
      }

      if (!cliOptions.quiet) {
        console.log(`Successfully compiled ${compiledFiles} ${compiledFiles !== 1 ? "files" : "file"} with Babel.`);
      }
    }

    if (cliOptions.watch) {
      const chokidar = util.requireChokidar();
      filenames.forEach(function (filenameOrDir) {
        const watcher = chokidar.watch(filenameOrDir, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 50,
            pollInterval: 10
          }
        });
        ["add", "change"].forEach(function (type) {
          watcher.on(type, function (filename) {
            handleFile(filename, filename === filenameOrDir ? _path().default.dirname(filenameOrDir) : filenameOrDir).catch(err => {
              console.error(err);
            });
          });
        });
      });
    }
  });
  return _ref.apply(this, arguments);
}