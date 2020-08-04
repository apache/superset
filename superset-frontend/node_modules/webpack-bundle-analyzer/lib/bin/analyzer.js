#! /usr/bin/env node
"use strict";

const {
  resolve,
  dirname
} = require('path');

const _ = require('lodash');

const commander = require('commander');

const {
  magenta
} = require('chalk');

const analyzer = require('../analyzer');

const viewer = require('../viewer');

const Logger = require('../Logger');

const SIZES = new Set(['stat', 'parsed', 'gzip']);
const program = commander.version(require('../../package.json').version).usage(`<bundleStatsFile> [bundleDir] [options]

  Arguments:
  
    bundleStatsFile  Path to Webpack Stats JSON file.
    bundleDir        Directory containing all generated bundles.
                     You should provided it if you want analyzer to show you the real parsed module sizes.
                     By default a directory of stats file is used.`).option('-m, --mode <mode>', 'Analyzer mode. Should be `server` or `static`.' + br('In `server` mode analyzer will start HTTP server to show bundle report.') + br('In `static` mode single HTML file with bundle report will be generated.'), 'server').option( // Had to make `host` parameter optional in order to let `-h` flag output help message
// Fixes https://github.com/webpack-contrib/webpack-bundle-analyzer/issues/239
'-h, --host [host]', 'Host that will be used in `server` mode to start HTTP server.', '127.0.0.1').option('-p, --port <n>', 'Port that will be used in `server` mode to start HTTP server.', 8888).option('-r, --report <file>', 'Path to bundle report file that will be generated in `static` mode.', 'report.html').option('-s, --default-sizes <type>', 'Module sizes to show in treemap by default.' + br(`Possible values: ${[...SIZES].join(', ')}`), 'parsed').option('-O, --no-open', "Don't open report in default browser automatically.").option('-e, --exclude <regexp>', 'Assets that should be excluded from the report.' + br('Can be specified multiple times.'), array()).option('-l, --log-level <level>', 'Log level.' + br(`Possible values: ${[...Logger.levels].join(', ')}`), Logger.defaultLevel).parse(process.argv);
let {
  mode,
  host,
  port,
  report: reportFilename,
  defaultSizes,
  logLevel,
  open: openBrowser,
  exclude: excludeAssets,
  args: [bundleStatsFile, bundleDir]
} = program;
const logger = new Logger(logLevel);
if (!bundleStatsFile) showHelp('Provide path to Webpack Stats file as first argument');
if (mode !== 'server' && mode !== 'static') showHelp('Invalid mode. Should be either `server` or `static`.');

if (mode === 'server') {
  if (!host) showHelp('Invalid host name');
  port = port === 'auto' ? 0 : Number(port);
  if (isNaN(port)) showHelp('Invalid port. Should be a number or `auto`');
}

if (!SIZES.has(defaultSizes)) showHelp(`Invalid default sizes option. Possible values are: ${[...SIZES].join(', ')}`);
bundleStatsFile = resolve(bundleStatsFile);
if (!bundleDir) bundleDir = dirname(bundleStatsFile);
let bundleStats;

try {
  bundleStats = analyzer.readStatsFromFile(bundleStatsFile);
} catch (err) {
  logger.error(`Couldn't read webpack bundle stats from "${bundleStatsFile}":\n${err}`);
  logger.debug(err.stack);
  process.exit(1);
}

if (mode === 'server') {
  viewer.startServer(bundleStats, {
    openBrowser,
    port,
    host,
    defaultSizes,
    bundleDir,
    excludeAssets,
    logger: new Logger(logLevel)
  });
} else {
  viewer.generateReport(bundleStats, {
    openBrowser,
    reportFilename: resolve(reportFilename),
    defaultSizes,
    bundleDir,
    excludeAssets,
    logger: new Logger(logLevel)
  });
}

function showHelp(error) {
  if (error) console.log(`\n  ${magenta(error)}\n`);
  program.outputHelp();
  process.exit(1);
}

function br(str) {
  return `\n${_.repeat(' ', 28)}${str}`;
}

function array() {
  const arr = [];
  return val => {
    arr.push(val);
    return arr;
  };
}