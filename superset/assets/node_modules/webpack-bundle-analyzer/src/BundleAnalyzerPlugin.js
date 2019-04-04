const bfj = require('bfj');
const path = require('path');
const mkdir = require('mkdirp');
const {bold} = require('chalk');

const Logger = require('./Logger');
const viewer = require('./viewer');

class BundleAnalyzerPlugin {

  constructor(opts) {
    this.opts = {
      analyzerMode: 'server',
      analyzerHost: '127.0.0.1',
      analyzerPort: 8888,
      reportFilename: 'report.html',
      defaultSizes: 'parsed',
      openAnalyzer: true,
      generateStatsFile: false,
      statsFilename: 'stats.json',
      statsOptions: null,
      excludeAssets: null,
      logLevel: 'info',
      // deprecated
      startAnalyzer: true,
      ...opts
    };

    this.server = null;
    this.logger = new Logger(this.opts.logLevel);
  }

  apply(compiler) {
    this.compiler = compiler;

    const done = stats => {
      stats = stats.toJson(this.opts.statsOptions);

      const actions = [];

      if (this.opts.generateStatsFile) {
        actions.push(() => this.generateStatsFile(stats));
      }

      // Handling deprecated `startAnalyzer` flag
      if (this.opts.analyzerMode === 'server' && !this.opts.startAnalyzer) {
        this.opts.analyzerMode = 'disabled';
      }

      if (this.opts.analyzerMode === 'server') {
        actions.push(() => this.startAnalyzerServer(stats));
      } else if (this.opts.analyzerMode === 'static') {
        actions.push(() => this.generateStaticReport(stats));
      }

      if (actions.length) {
        // Making analyzer logs to be after all webpack logs in the console
        setImmediate(() => {
          actions.forEach(action => action());
        });
      }
    };

    if (compiler.hooks) {
      compiler.hooks.done.tap('webpack-bundle-analyzer', done);
    } else {
      compiler.plugin('done', done);
    }
  }

  async generateStatsFile(stats) {
    const statsFilepath = path.resolve(this.compiler.outputPath, this.opts.statsFilename);
    mkdir.sync(path.dirname(statsFilepath));

    try {
      await bfj.write(statsFilepath, stats, {
        space: 2,
        promises: 'ignore',
        buffers: 'ignore',
        maps: 'ignore',
        iterables: 'ignore',
        circular: 'ignore'
      });

      this.logger.info(
        `${bold('Webpack Bundle Analyzer')} saved stats file to ${bold(statsFilepath)}`
      );
    } catch (error) {
      this.logger.error(
        `${bold('Webpack Bundle Analyzer')} error saving stats file to ${bold(statsFilepath)}: ${error}`
      );
    }
  }

  async startAnalyzerServer(stats) {
    if (this.server) {
      (await this.server).updateChartData(stats);
    } else {
      this.server = viewer.startServer(stats, {
        openBrowser: this.opts.openAnalyzer,
        host: this.opts.analyzerHost,
        port: this.opts.analyzerPort,
        bundleDir: this.getBundleDirFromCompiler(),
        logger: this.logger,
        defaultSizes: this.opts.defaultSizes,
        excludeAssets: this.opts.excludeAssets
      });
    }
  }

  generateStaticReport(stats) {
    viewer.generateReport(stats, {
      openBrowser: this.opts.openAnalyzer,
      reportFilename: path.resolve(this.compiler.outputPath, this.opts.reportFilename),
      bundleDir: this.getBundleDirFromCompiler(),
      logger: this.logger,
      defaultSizes: this.opts.defaultSizes,
      excludeAssets: this.opts.excludeAssets
    });
  }

  getBundleDirFromCompiler() {
    return (this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem') ? null : this.compiler.outputPath;
  }

}

module.exports = BundleAnalyzerPlugin;
