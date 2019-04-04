'use strict';

const path = require('path');
const mime = require('mime');
const DevMiddlewareError = require('./DevMiddlewareError');
const { getFilenameFromUrl, handleRangeHeaders, handleRequest, ready } = require('./util');

module.exports = function wrapper(context) {
  return function middleware(req, res, next) {
    // fixes #282. credit @cexoso. in certain edge situations res.locals is
    // undefined.
    res.locals = res.locals || {};

    function goNext() {
      if (!context.options.serverSideRender) {
        return next();
      }

      return new Promise(((resolve) => {
        ready(context, () => {
          res.locals.webpackStats = context.webpackStats;
          res.locals.fs = context.fs;
          resolve(next());
        }, req);
      }));
    }

    const acceptedMethods = context.options.methods || ['GET'];
    if (acceptedMethods.indexOf(req.method) === -1) {
      return goNext();
    }

    let filename = getFilenameFromUrl(context.options.publicPath, context.compiler, req.url);

    if (filename === false) {
      return goNext();
    }

    return new Promise(((resolve) => {
      handleRequest(context, filename, processRequest, req);
      function processRequest() {
        try {
          let stat = context.fs.statSync(filename);

          if (!stat.isFile()) {
            if (stat.isDirectory()) {
              let { index } = context.options;

              if (index === undefined || index === true) {
                index = 'index.html';
              } else if (!index) {
                throw new DevMiddlewareError('next');
              }

              filename = path.posix.join(filename, index);
              stat = context.fs.statSync(filename);
              if (!stat.isFile()) {
                throw new DevMiddlewareError('next');
              }
            } else {
              throw new DevMiddlewareError('next');
            }
          }
        } catch (e) {
          return resolve(goNext());
        }

        // server content
        let content = context.fs.readFileSync(filename);
        content = handleRangeHeaders(content, req, res);

        let contentType = mime.getType(filename);

        // do not add charset to WebAssembly files, otherwise compileStreaming will fail in the client
        if (!/\.wasm$/.test(filename)) {
          contentType += '; charset=UTF-8';
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', content.length);

        const { headers } = context.options;
        if (headers) {
          for (const name in headers) {
            if ({}.hasOwnProperty.call(headers, name)) {
              res.setHeader(name, context.options.headers[name]);
            }
          }
        }
        // Express automatically sets the statusCode to 200, but not all servers do (Koa).
        res.statusCode = res.statusCode || 200;
        if (res.send) res.send(content);
        else res.end(content);
        resolve();
      }
    }));
  };
};
