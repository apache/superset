'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sourceMap = require('source-map');

var _webpackSources = require('webpack-sources');

var _RequestShortener = require('webpack/lib/RequestShortener');

var _RequestShortener2 = _interopRequireDefault(_RequestShortener);

var _ModuleFilenameHelpers = require('webpack/lib/ModuleFilenameHelpers');

var _ModuleFilenameHelpers2 = _interopRequireDefault(_ModuleFilenameHelpers);

var _schemaUtils = require('schema-utils');

var _schemaUtils2 = _interopRequireDefault(_schemaUtils);

var _options = require('./options.json');

var _options2 = _interopRequireDefault(_options);

var _TaskRunner = require('./TaskRunner');

var _TaskRunner2 = _interopRequireDefault(_TaskRunner);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const warningRegex = /\[.+:([0-9]+),([0-9]+)\]/; /* eslint-disable
                                                   no-param-reassign
                                                 */


class TerserPlugin {
  constructor(options = {}) {
    (0, _schemaUtils2.default)(_options2.default, options, 'Terser Plugin');

    const {
      minify,
      terserOptions = {},
      test = /\.js(\?.*)?$/i,
      warningsFilter = () => true,
      extractComments = false,
      sourceMap = false,
      cache = false,
      cacheKeys = defaultCacheKeys => defaultCacheKeys,
      parallel = false,
      include,
      exclude
    } = options;

    this.options = {
      test,
      warningsFilter,
      extractComments,
      sourceMap,
      cache,
      cacheKeys,
      parallel,
      include,
      exclude,
      minify,
      terserOptions: Object.assign({
        output: {
          comments: extractComments ? false : /^\**!|@preserve|@license|@cc_on/i
        }
      }, terserOptions)
    };
  }

  static isSourceMap(input) {
    // All required options for `new SourceMapConsumer(...options)`
    // https://github.com/mozilla/source-map#new-sourcemapconsumerrawsourcemap
    return Boolean(input && input.version && input.sources && Array.isArray(input.sources) && typeof input.mappings === 'string');
  }

  static buildSourceMap(inputSourceMap) {
    if (!inputSourceMap || !TerserPlugin.isSourceMap(inputSourceMap)) {
      return null;
    }

    return new _sourceMap.SourceMapConsumer(inputSourceMap);
  }

  static buildError(err, file, sourceMap, requestShortener) {
    // Handling error which should have line, col, filename and message
    if (err.line) {
      const original = sourceMap && sourceMap.originalPositionFor({
        line: err.line,
        column: err.col
      });

      if (original && original.source && requestShortener) {
        return new Error(`${file} from Terser\n${err.message} [${requestShortener.shorten(original.source)}:${original.line},${original.column}][${file}:${err.line},${err.col}]`);
      }

      return new Error(`${file} from Terser\n${err.message} [${file}:${err.line},${err.col}]`);
    } else if (err.stack) {
      return new Error(`${file} from Terser\n${err.stack}`);
    }

    return new Error(`${file} from Terser\n${err.message}`);
  }

  static buildWarning(warning, file, sourceMap, requestShortener, warningsFilter) {
    let warningMessage = warning;
    let locationMessage = '';
    let source = null;

    if (sourceMap) {
      const match = warningRegex.exec(warning);

      if (match) {
        const line = +match[1];
        const column = +match[2];
        const original = sourceMap.originalPositionFor({
          line,
          column
        });

        if (original && original.source && original.source !== file && requestShortener) {
          ({ source } = original);
          warningMessage = `${warningMessage.replace(warningRegex, '')}`;

          locationMessage = `[${requestShortener.shorten(original.source)}:${original.line},${original.column}]`;
        }
      }
    }

    if (warningsFilter && !warningsFilter(warning, source)) {
      return null;
    }

    return `Terser Plugin: ${warningMessage}${locationMessage}`;
  }

  apply(compiler) {
    const buildModuleFn = moduleArg => {
      // to get detailed location info about errors
      moduleArg.useSourceMap = true;
    };

    const optimizeFn = (compilation, chunks, callback) => {
      const taskRunner = new _TaskRunner2.default({
        cache: this.options.cache,
        parallel: this.options.parallel
      });

      const processedAssets = new WeakSet();
      const tasks = [];

      chunks.reduce((acc, chunk) => acc.concat(chunk.files || []), []).concat(compilation.additionalChunkAssets || []).filter(_ModuleFilenameHelpers2.default.matchObject.bind(null, this.options)).forEach(file => {
        let inputSourceMap;

        const asset = compilation.assets[file];

        if (processedAssets.has(asset)) {
          return;
        }

        try {
          let input;

          if (this.options.sourceMap && asset.sourceAndMap) {
            const { source, map } = asset.sourceAndMap();

            input = source;

            if (TerserPlugin.isSourceMap(map)) {
              inputSourceMap = map;
            } else {
              inputSourceMap = map;

              compilation.warnings.push(new Error(`${file} contains invalid source map`));
            }
          } else {
            input = asset.source();
            inputSourceMap = null;
          }

          // Handling comment extraction
          let commentsFile = false;

          if (this.options.extractComments) {
            commentsFile = this.options.extractComments.filename || `${file}.LICENSE`;

            if (typeof commentsFile === 'function') {
              commentsFile = commentsFile(file);
            }
          }

          const task = {
            file,
            input,
            inputSourceMap,
            commentsFile,
            extractComments: this.options.extractComments,
            terserOptions: this.options.terserOptions,
            minify: this.options.minify
          };

          if (this.options.cache) {
            const { outputPath } = compiler;
            const defaultCacheKeys = {
              // eslint-disable-next-line global-require
              terser: require('terser/package.json').version,
              // eslint-disable-next-line global-require
              'terser-webpack-plugin': require('../package.json').version,
              'terser-webpack-plugin-options': this.options,
              path: `${outputPath ? `${outputPath}/` : ''}${file}`,
              hash: _crypto2.default.createHash('md4').update(input).digest('hex')
            };

            task.cacheKeys = this.options.cacheKeys(defaultCacheKeys, file);
          }

          tasks.push(task);
        } catch (error) {
          compilation.errors.push(TerserPlugin.buildError(error, file, TerserPlugin.buildSourceMap(inputSourceMap), new _RequestShortener2.default(compiler.context)));
        }
      });

      taskRunner.run(tasks, (tasksError, results) => {
        if (tasksError) {
          compilation.errors.push(tasksError);

          return;
        }

        results.forEach((data, index) => {
          const { file, input, inputSourceMap, commentsFile } = tasks[index];
          const { error, map, code, warnings, extractedComments } = data;

          let sourceMap = null;

          if (error || warnings && warnings.length > 0) {
            sourceMap = TerserPlugin.buildSourceMap(inputSourceMap);
          }

          // Handling results
          // Error case: add errors, and go to next file
          if (error) {
            compilation.errors.push(TerserPlugin.buildError(error, file, sourceMap, new _RequestShortener2.default(compiler.context)));

            return;
          }

          let outputSource;

          if (map) {
            outputSource = new _webpackSources.SourceMapSource(code, file, JSON.parse(map), input, inputSourceMap);
          } else {
            outputSource = new _webpackSources.RawSource(code);
          }

          // Write extracted comments to commentsFile
          if (commentsFile && extractedComments.length > 0) {
            // Add a banner to the original file
            if (this.options.extractComments.banner !== false) {
              let banner = this.options.extractComments.banner || `For license information please see ${_path2.default.posix.basename(commentsFile)}`;

              if (typeof banner === 'function') {
                banner = banner(commentsFile);
              }

              if (banner) {
                outputSource = new _webpackSources.ConcatSource(`/*! ${banner} */\n`, outputSource);
              }
            }

            const commentsSource = new _webpackSources.RawSource(`${extractedComments.join('\n\n')}\n`);

            if (commentsFile in compilation.assets) {
              // commentsFile already exists, append new comments...
              if (compilation.assets[commentsFile] instanceof _webpackSources.ConcatSource) {
                compilation.assets[commentsFile].add('\n');
                compilation.assets[commentsFile].add(commentsSource);
              } else {
                compilation.assets[commentsFile] = new _webpackSources.ConcatSource(compilation.assets[commentsFile], '\n', commentsSource);
              }
            } else {
              compilation.assets[commentsFile] = commentsSource;
            }
          }

          // Updating assets
          processedAssets.add(compilation.assets[file] = outputSource);

          // Handling warnings
          if (warnings && warnings.length > 0) {
            warnings.forEach(warning => {
              const builtWarning = TerserPlugin.buildWarning(warning, file, sourceMap, new _RequestShortener2.default(compiler.context), this.options.warningsFilter);

              if (builtWarning) {
                compilation.warnings.push(builtWarning);
              }
            });
          }
        });

        taskRunner.exit();

        callback();
      });
    };

    const plugin = { name: this.constructor.name };

    compiler.hooks.compilation.tap(plugin, compilation => {
      if (this.options.sourceMap) {
        compilation.hooks.buildModule.tap(plugin, buildModuleFn);
      }

      compilation.hooks.optimizeChunkAssets.tapAsync(plugin, optimizeFn.bind(this, compilation));
    });
  }
}

exports.default = TerserPlugin;