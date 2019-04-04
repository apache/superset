'use strict';

/* eslint-disable
  no-shadow,
  global-require,
  multiline-ternary,
  array-bracket-spacing,
  space-before-function-paren
*/
const open = require('opn');

const colors = {
  info (useColor, msg) {
    if (useColor) {
      // Make text blue and bold, so it *pops*
      return `\u001b[1m\u001b[34m${msg}\u001b[39m\u001b[22m`;
    }

    return msg;
  },
  error (useColor, msg) {
    if (useColor) {
      // Make text red and bold, so it *pops*
      return `\u001b[1m\u001b[31m${msg}\u001b[39m\u001b[22m`;
    }

    return msg;
  }
};

// eslint-disable-next-line
const defaultTo = (value, def) => {
  return value == null ? def : value;
};

function version () {
  return `webpack-dev-server ${require('../package.json').version}\n` +
  `webpack ${require('webpack/package.json').version}`;
}

function status (uri, options, log, useColor) {
  const contentBase = Array.isArray(options.contentBase)
    ? options.contentBase.join(', ')
    : options.contentBase;

  if (options.socket) {
    log.info(`Listening to socket at ${colors.info(useColor, options.socket)}`);
  } else {
    log.info(`Project is running at ${colors.info(useColor, uri)}`);
  }

  log.info(
    `webpack output is served from ${colors.info(useColor, options.publicPath)}`
  );

  if (contentBase) {
    log.info(
      `Content not from webpack is served from ${colors.info(useColor, contentBase)}`
    );
  }

  if (options.historyApiFallback) {
    log.info(
      `404s will fallback to ${colors.info(useColor, options.historyApiFallback.index || '/index.html')}`
    );
  }

  if (options.bonjour) {
    log.info(
      'Broadcasting "http" with subtype of "webpack" via ZeroConf DNS (Bonjour)'
    );
  }

  if (options.open) {
    let openOptions = {};
    let openMessage = 'Unable to open browser';

    if (typeof options.open === 'string') {
      openOptions = { app: options.open };
      openMessage += `: ${options.open}`;
    }

    open(uri + (options.openPage || ''), openOptions).catch(() => {
      log.warn(
        `${openMessage}. If you are running in a headless environment, please do not use the --open flag`
      );
    });
  }
}

function bonjour (options) {
  const bonjour = require('bonjour')();

  bonjour.publish({
    name: 'Webpack Dev Server',
    port: options.port,
    type: 'http',
    subtypes: [ 'webpack' ]
  });

  process.on('exit', () => {
    bonjour.unpublishAll(() => {
      bonjour.destroy();
    });
  });
}

module.exports = {
  status,
  colors,
  version,
  bonjour,
  defaultTo
};
