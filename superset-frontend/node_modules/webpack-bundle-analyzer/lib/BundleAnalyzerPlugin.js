"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const bfj = require('bfj');

const path = require('path');

const mkdir = require('mkdirp');

const {
  bold
} = require('chalk');

const Logger = require('./Logger');

const viewer = require('./viewer');

class BundleAnalyzerPlugin {
  constructor(opts = {}) {
    this.opts = _objectSpread({
      analyzerMode: 'server',
      analyzerHost: '127.0.0.1',
      reportFilename: 'report.html',
      defaultSizes: 'parsed',
      openAnalyzer: true,
      generateStatsFile: false,
      statsFilename: 'stats.json',
      statsOptions: null,
      excludeAssets: null,
      logLevel: 'info',
      // deprecated
      startAnalyzer: true
    }, opts, {
      analyzerPort: 'analyzerPort' in opts ? opts.analyzerPort === 'auto' ? 0 : opts.analyzerPort : 8888
    });
    this.server = null;
    this.logger = new Logger(this.opts.logLevel);
  }

  apply(compiler) {
    this.compiler = compiler;

    const done = (stats, callback) => {
      callback = callback || (() => {});

      const actions = [];

      if (this.opts.generateStatsFile) {
        actions.push(() => this.generateStatsFile(stats.toJson(this.opts.statsOptions)));
      } // Handling deprecated `startAnalyzer` flag


      if (this.opts.analyzerMode === 'server' && !this.opts.startAnalyzer) {
        this.opts.analyzerMode = 'disabled';
      }

      if (this.opts.analyzerMode === 'server') {
        actions.push(() => this.startAnalyzerServer(stats.toJson()));
      } else if (this.opts.analyzerMode === 'static') {
        actions.push(() => this.generateStaticReport(stats.toJson()));
      }

      if (actions.length) {
        // Making analyzer logs to be after all webpack logs in the console
        setImmediate( /*#__PURE__*/_asyncToGenerator(function* () {
          try {
            yield Promise.all(actions.map(action => action()));
            callback();
          } catch (e) {
            callback(e);
          }
        }));
      } else {
        callback();
      }
    };

    if (compiler.hooks) {
      compiler.hooks.done.tapAsync('webpack-bundle-analyzer', done);
    } else {
      compiler.plugin('done', done);
    }
  }

  generateStatsFile(stats) {
    var _this = this;

    return _asyncToGenerator(function* () {
      const statsFilepath = path.resolve(_this.compiler.outputPath, _this.opts.statsFilename);
      mkdir.sync(path.dirname(statsFilepath));

      try {
        yield bfj.write(statsFilepath, stats, {
          space: 2,
          promises: 'ignore',
          buffers: 'ignore',
          maps: 'ignore',
          iterables: 'ignore',
          circular: 'ignore'
        });

        _this.logger.info(`${bold('Webpack Bundle Analyzer')} saved stats file to ${bold(statsFilepath)}`);
      } catch (error) {
        _this.logger.error(`${bold('Webpack Bundle Analyzer')} error saving stats file to ${bold(statsFilepath)}: ${error}`);
      }
    })();
  }

  startAnalyzerServer(stats) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      if (_this2.server) {
        (yield _this2.server).updateChartData(stats);
      } else {
        _this2.server = viewer.startServer(stats, {
          openBrowser: _this2.opts.openAnalyzer,
          host: _this2.opts.analyzerHost,
          port: _this2.opts.analyzerPort,
          bundleDir: _this2.getBundleDirFromCompiler(),
          logger: _this2.logger,
          defaultSizes: _this2.opts.defaultSizes,
          excludeAssets: _this2.opts.excludeAssets
        });
      }
    })();
  }

  generateStaticReport(stats) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      yield viewer.generateReport(stats, {
        openBrowser: _this3.opts.openAnalyzer,
        reportFilename: path.resolve(_this3.compiler.outputPath, _this3.opts.reportFilename),
        bundleDir: _this3.getBundleDirFromCompiler(),
        logger: _this3.logger,
        defaultSizes: _this3.opts.defaultSizes,
        excludeAssets: _this3.opts.excludeAssets
      });
    })();
  }

  getBundleDirFromCompiler() {
    switch (this.compiler.outputFileSystem.constructor.name) {
      case 'MemoryFileSystem':
        return null;
      // Detect AsyncMFS used by Nuxt 2.5 that replaces webpack's MFS during development
      // Related: #274

      case 'AsyncMFS':
        return null;

      default:
        return this.compiler.outputPath;
    }
  }

}

module.exports = BundleAnalyzerPlugin;