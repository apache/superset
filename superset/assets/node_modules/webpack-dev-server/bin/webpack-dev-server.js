#!/usr/bin/env node

'use strict';

/* eslint-disable
  import/order,
  import/no-extraneous-dependencies,
  global-require,
  no-shadow,
  no-console,
  multiline-ternary,
  arrow-parens,
  array-bracket-spacing,
  space-before-function-paren
*/
const debug = require('debug')('webpack-dev-server');

const fs = require('fs');
const net = require('net');
const path = require('path');

const portfinder = require('portfinder');
const importLocal = require('import-local');

const yargs = require('yargs');
const webpack = require('webpack');

const options = require('./options');

const {
  colors,
  status,
  version,
  bonjour,
  defaultTo
} = require('./utils');

const Server = require('../lib/Server');

const addEntries = require('../lib/utils/addEntries');
const createDomain = require('../lib/utils/createDomain');
const createLogger = require('../lib/utils/createLogger');

let server;

const signals = [ 'SIGINT', 'SIGTERM' ];

signals.forEach((signal) => {
  process.on(signal, () => {
    if (server) {
      server.close(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
      });
    } else {
      // eslint-disable-next-line no-process-exit
      process.exit();
    }
  });
});

// Prefer the local installation of webpack-dev-server
if (importLocal(__filename)) {
  debug('Using local install of webpack-dev-server');

  return;
}

try {
  require.resolve('webpack-cli');
} catch (err) {
  console.error('The CLI moved into a separate package: webpack-cli');
  console.error('Please install \'webpack-cli\' in addition to webpack itself to use the CLI');
  console.error('-> When using npm: npm i -D webpack-cli');
  console.error('-> When using yarn: yarn add -D webpack-cli');

  process.exitCode = 1;
}

yargs.usage(
  `${version()}\nUsage:  https://webpack.js.org/configuration/dev-server/`
);

require('webpack-cli/bin/config-yargs')(yargs);
// It is important that this is done after the webpack yargs config,
// so it overrides webpack's version info.
yargs.version(version());
yargs.options(options);

const argv = yargs.argv;

const config = require('webpack-cli/bin/convert-argv')(yargs, argv, {
  outputFilename: '/bundle.js'
});
// Taken out of yargs because we must know if
// it wasn't given by the user, in which case
// we should use portfinder.
const DEFAULT_PORT = 8080;

function processOptions (config) {
  // processOptions {Promise}
  if (typeof config.then === 'function') {
    config.then(processOptions).catch((err) => {
      console.error(err.stack || err);
      // eslint-disable-next-line no-process-exit
      process.exit();
    });

    return;
  }

  const firstWpOpt = Array.isArray(config)
    ? config[0]
    : config;

  const options = config.devServer || firstWpOpt.devServer || {};

  if (argv.bonjour) {
    options.bonjour = true;
  }

  if (argv.host !== 'localhost' || !options.host) {
    options.host = argv.host;
  }

  if (argv['allowed-hosts']) {
    options.allowedHosts = argv['allowed-hosts'].split(',');
  }

  if (argv.public) {
    options.public = argv.public;
  }

  if (argv.socket) {
    options.socket = argv.socket;
  }

  if (argv.progress) {
    options.progress = argv.progress;
  }

  if (!options.publicPath) {
    // eslint-disable-next-line
    options.publicPath = firstWpOpt.output && firstWpOpt.output.publicPath || '';

    if (
      !/^(https?:)?\/\//.test(options.publicPath) &&
      options.publicPath[0] !== '/'
    ) {
      options.publicPath = `/${options.publicPath}`;
    }
  }

  if (!options.filename) {
    options.filename = firstWpOpt.output && firstWpOpt.output.filename;
  }

  if (!options.watchOptions) {
    options.watchOptions = firstWpOpt.watchOptions;
  }

  if (argv.stdin) {
    process.stdin.on('end', () => {
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    });

    process.stdin.resume();
  }

  if (!options.hot) {
    options.hot = argv.hot;
  }

  if (!options.hotOnly) {
    options.hotOnly = argv['hot-only'];
  }

  if (!options.clientLogLevel) {
    options.clientLogLevel = argv['client-log-level'];
  }

  // eslint-disable-next-line
  if (options.contentBase === undefined) {
    if (argv['content-base']) {
      options.contentBase = argv['content-base'];

      if (Array.isArray(options.contentBase)) {
        options.contentBase = options.contentBase.map((p) => path.resolve(p));
      } else if (/^[0-9]$/.test(options.contentBase)) {
        options.contentBase = +options.contentBase;
      } else if (!/^(https?:)?\/\//.test(options.contentBase)) {
        options.contentBase = path.resolve(options.contentBase);
      }
      // It is possible to disable the contentBase by using
      // `--no-content-base`, which results in arg["content-base"] = false
    } else if (argv['content-base'] === false) {
      options.contentBase = false;
    }
  }

  if (argv['watch-content-base']) {
    options.watchContentBase = true;
  }

  if (!options.stats) {
    options.stats = {
      cached: false,
      cachedAssets: false
    };
  }

  if (
    typeof options.stats === 'object' &&
    typeof options.stats.colors === 'undefined'
  ) {
    options.stats = Object.assign(
      {},
      options.stats,
      { colors: argv.color }
    );
  }

  if (argv.lazy) {
    options.lazy = true;
  }

  if (!argv.info) {
    options.noInfo = true;
  }

  if (argv.quiet) {
    options.quiet = true;
  }

  if (argv.https) {
    options.https = true;
  }

  if (argv.cert) {
    options.cert = fs.readFileSync(
      path.resolve(argv.cert)
    );
  }

  if (argv.key) {
    options.key = fs.readFileSync(
      path.resolve(argv.key)
    );
  }

  if (argv.cacert) {
    options.ca = fs.readFileSync(
      path.resolve(argv.cacert)
    );
  }

  if (argv.pfx) {
    options.pfx = fs.readFileSync(
      path.resolve(argv.pfx)
    );
  }

  if (argv['pfx-passphrase']) {
    options.pfxPassphrase = argv['pfx-passphrase'];
  }

  if (argv.inline === false) {
    options.inline = false;
  }

  if (argv['history-api-fallback']) {
    options.historyApiFallback = true;
  }

  if (argv.compress) {
    options.compress = true;
  }

  if (argv['disable-host-check']) {
    options.disableHostCheck = true;
  }

  if (argv['open-page']) {
    options.open = true;
    options.openPage = argv['open-page'];
  }

  if (typeof argv.open !== 'undefined') {
    options.open = argv.open !== '' ? argv.open : true;
  }

  if (options.open && !options.openPage) {
    options.openPage = '';
  }

  if (argv.useLocalIp) {
    options.useLocalIp = true;
  }
  // Kind of weird, but ensures prior behavior isn't broken in cases
  // that wouldn't throw errors. E.g. both argv.port and options.port
  // were specified, but since argv.port is 8080, options.port will be
  // tried first instead.
  options.port = argv.port === DEFAULT_PORT
    ? defaultTo(options.port, argv.port)
    : defaultTo(argv.port, options.port);

  if (options.port != null) {
    startDevServer(config, options);

    return;
  }

  portfinder.basePort = DEFAULT_PORT;

  portfinder.getPort((err, port) => {
    if (err) {
      throw err;
    }

    options.port = port;

    startDevServer(config, options);
  });
}

function startDevServer(config, options) {
  const log = createLogger(options);

  addEntries(config, options);

  let compiler;

  try {
    compiler = webpack(config);
  } catch (err) {
    if (err instanceof webpack.WebpackOptionsValidationError) {
      log.error(colors.error(options.stats.colors, err.message));
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }

    throw err;
  }

  if (options.progress) {
    new webpack.ProgressPlugin({
      profile: argv.profile
    }).apply(compiler);
  }

  const suffix = (options.inline !== false || options.lazy === true ? '/' : '/webpack-dev-server/');

  try {
    server = new Server(compiler, options, log);
  } catch (err) {
    if (err.name === 'ValidationError') {
      log.error(colors.error(options.stats.colors, err.message));
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }

    throw err;
  }

  if (options.socket) {
    server.listeningApp.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        const clientSocket = new net.Socket();

        clientSocket.on('error', (err) => {
          if (err.code === 'ECONNREFUSED') {
            // No other server listening on this socket so it can be safely removed
            fs.unlinkSync(options.socket);

            server.listen(options.socket, options.host, (error) => {
              if (error) {
                throw error;
              }
            });
          }
        });

        clientSocket.connect({ path: options.socket }, () => {
          throw new Error('This socket is already used');
        });
      }
    });

    server.listen(options.socket, options.host, (err) => {
      if (err) {
        throw err;
      }
      // chmod 666 (rw rw rw)
      const READ_WRITE = 438;

      fs.chmod(options.socket, READ_WRITE, (err) => {
        if (err) {
          throw err;
        }

        const uri = createDomain(options, server.listeningApp) + suffix;

        status(uri, options, log, argv.color);
      });
    });
  } else {
    server.listen(options.port, options.host, (err) => {
      if (err) {
        throw err;
      }

      if (options.bonjour) {
        bonjour(options);
      }

      const uri = createDomain(options, server.listeningApp) + suffix;

      status(uri, options, log, argv.color);
    });
  }
}

processOptions(config);
