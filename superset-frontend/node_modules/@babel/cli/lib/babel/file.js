"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _convertSourceMap() {
  const data = _interopRequireDefault(require("convert-source-map"));

  _convertSourceMap = function () {
    return data;
  };

  return data;
}

function _defaults() {
  const data = _interopRequireDefault(require("lodash/defaults"));

  _defaults = function () {
    return data;
  };

  return data;
}

function _sourceMap() {
  const data = _interopRequireDefault(require("source-map"));

  _sourceMap = function () {
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

function _makeDir() {
  const data = require("make-dir");

  _makeDir = function () {
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

function _default(_x) {
  return _ref.apply(this, arguments);
}

function _ref() {
  _ref = _asyncToGenerator(function* ({
    cliOptions,
    babelOptions
  }) {
    function buildResult(fileResults) {
      const map = new (_sourceMap().default.SourceMapGenerator)({
        file: cliOptions.sourceMapTarget || _path().default.basename(cliOptions.outFile || "") || "stdout",
        sourceRoot: babelOptions.sourceRoot
      });
      let code = "";
      let offset = 0;

      for (const result of fileResults) {
        if (!result) continue;
        code += result.code + "\n";

        if (result.map) {
          const consumer = new (_sourceMap().default.SourceMapConsumer)(result.map);
          const sources = new Set();
          consumer.eachMapping(function (mapping) {
            if (mapping.source != null) sources.add(mapping.source);
            map.addMapping({
              generated: {
                line: mapping.generatedLine + offset,
                column: mapping.generatedColumn
              },
              source: mapping.source,
              original: mapping.source == null ? null : {
                line: mapping.originalLine,
                column: mapping.originalColumn
              }
            });
          });
          sources.forEach(source => {
            const content = consumer.sourceContentFor(source, true);

            if (content !== null) {
              map.setSourceContent(source, content);
            }
          });
          offset = code.split("\n").length - 1;
        }
      }

      if (babelOptions.sourceMaps === "inline" || !cliOptions.outFile && babelOptions.sourceMaps) {
        code += "\n" + _convertSourceMap().default.fromObject(map).toComment();
      }

      return {
        map: map,
        code: code
      };
    }

    function output(fileResults) {
      const result = buildResult(fileResults);

      if (cliOptions.outFile) {
        (0, _makeDir().sync)(_path().default.dirname(cliOptions.outFile));

        if (babelOptions.sourceMaps && babelOptions.sourceMaps !== "inline") {
          const mapLoc = cliOptions.outFile + ".map";
          result.code = util.addSourceMappingUrl(result.code, mapLoc);

          _fs().default.writeFileSync(mapLoc, JSON.stringify(result.map));
        }

        _fs().default.writeFileSync(cliOptions.outFile, result.code);
      } else {
        process.stdout.write(result.code + "\n");
      }
    }

    function readStdin() {
      return new Promise((resolve, reject) => {
        let code = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("readable", function () {
          const chunk = process.stdin.read();
          if (chunk !== null) code += chunk;
        });
        process.stdin.on("end", function () {
          resolve(code);
        });
        process.stdin.on("error", reject);
      });
    }

    function stdin() {
      return _stdin.apply(this, arguments);
    }

    function _stdin() {
      _stdin = _asyncToGenerator(function* () {
        const code = yield readStdin();
        const res = yield util.transform(cliOptions.filename, code, (0, _defaults().default)({
          sourceFileName: "stdin"
        }, babelOptions));
        output([res]);
      });
      return _stdin.apply(this, arguments);
    }

    function walk(_x2) {
      return _walk.apply(this, arguments);
    }

    function _walk() {
      _walk = _asyncToGenerator(function* (filenames) {
        const _filenames = [];
        filenames.forEach(function (filename) {
          if (!_fs().default.existsSync(filename)) return;

          const stat = _fs().default.statSync(filename);

          if (stat.isDirectory()) {
            const dirname = filename;
            util.readdirForCompilable(filename, cliOptions.includeDotfiles, cliOptions.extensions).forEach(function (filename) {
              _filenames.push(_path().default.join(dirname, filename));
            });
          } else {
            _filenames.push(filename);
          }
        });
        const results = yield Promise.all(_filenames.map(function () {
          var _ref2 = _asyncToGenerator(function* (filename) {
            let sourceFilename = filename;

            if (cliOptions.outFile) {
              sourceFilename = _path().default.relative(_path().default.dirname(cliOptions.outFile), sourceFilename);
            }

            sourceFilename = (0, _slash().default)(sourceFilename);

            try {
              return yield util.compile(filename, (0, _defaults().default)({
                sourceFileName: sourceFilename,
                sourceMaps: babelOptions.sourceMaps === "inline" ? true : babelOptions.sourceMaps
              }, babelOptions));
            } catch (err) {
              if (!cliOptions.watch) {
                throw err;
              }

              console.error(err);
              return null;
            }
          });

          return function (_x4) {
            return _ref2.apply(this, arguments);
          };
        }()));
        output(results);
      });
      return _walk.apply(this, arguments);
    }

    function files(_x3) {
      return _files.apply(this, arguments);
    }

    function _files() {
      _files = _asyncToGenerator(function* (filenames) {
        if (!cliOptions.skipInitialBuild) {
          yield walk(filenames);
        }

        if (cliOptions.watch) {
          const chokidar = util.requireChokidar();
          chokidar.watch(filenames, {
            disableGlobbing: true,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
              stabilityThreshold: 50,
              pollInterval: 10
            }
          }).on("all", function (type, filename) {
            if (!util.isCompilableExtension(filename, cliOptions.extensions) && !filenames.includes(filename)) {
              return;
            }

            if (type === "add" || type === "change") {
              if (cliOptions.verbose) {
                console.log(type + " " + filename);
              }

              walk(filenames).catch(err => {
                console.error(err);
              });
            }
          });
        }
      });
      return _files.apply(this, arguments);
    }

    if (cliOptions.filenames.length) {
      yield files(cliOptions.filenames);
    } else {
      yield stdin();
    }
  });
  return _ref.apply(this, arguments);
}