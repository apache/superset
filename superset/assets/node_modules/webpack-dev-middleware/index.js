'use strict';

const mime = require('mime');
const createContext = require('./lib/context');
const middleware = require('./lib/middleware');
const reporter = require('./lib/reporter');
const { setFs, toDisk } = require('./lib/fs');
const { getFilenameFromUrl, noop, ready } = require('./lib/util');

const defaults = {
  logLevel: 'info',
  logTime: false,
  logger: null,
  mimeTypes: null,
  reporter,
  stats: {
    colors: true,
    context: process.cwd()
  },
  watchOptions: {
    aggregateTimeout: 200
  },
  writeToDisk: false
};

module.exports = function wdm(compiler, opts) {
  const options = Object.assign({}, defaults, opts);

  if (options.lazy) {
    if (typeof options.filename === 'string') {
      const filename = options.filename
        .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&') // eslint-disable-line no-useless-escape
        .replace(/\\\[[a-z]+\\\]/ig, '.+');

      options.filename = new RegExp(`^[/]{0,1}${filename}$`);
    }
  }

  // defining custom MIME type
  if (options.mimeTypes) {
    mime.define(options.mimeTypes);
  }

  const context = createContext(compiler, options);

  // start watching
  if (!options.lazy) {
    const watching = compiler.watch(options.watchOptions, (err) => {
      if (err) {
        context.log.error(err.stack || err);
        if (err.details) {
          context.log.error(err.details);
        }
      }
    });

    context.watching = watching;
  } else {
    context.state = true;
  }

  if (options.writeToDisk) {
    toDisk(context);
  }

  setFs(context, compiler);

  return Object.assign(middleware(context), {
    close(callback) {
      callback = callback || noop;

      if (context.watching) {
        context.watching.close(callback);
      } else {
        callback();
      }
    },

    context,

    fileSystem: context.fs,

    getFilenameFromUrl: getFilenameFromUrl.bind(this, context.options.publicPath, context.compiler),

    invalidate(callback) {
      callback = callback || noop;
      if (context.watching) {
        ready(context, callback, {});
        context.watching.invalidate();
      } else {
        callback();
      }
    },

    waitUntilValid(callback) {
      callback = callback || noop;
      ready(context, callback, {});
    }
  });
};
