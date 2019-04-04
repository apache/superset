'use strict';

/* eslint-disable
  import/order,
  no-shadow,
  no-undefined,
  func-names,
  multiline-ternary,
  array-bracket-spacing,
  space-before-function-paren
*/
const fs = require('fs');
const path = require('path');

const ip = require('ip');
const tls = require('tls');
const url = require('url');
const http = require('http');
const https = require('https');
const spdy = require('spdy');
const sockjs = require('sockjs');

const semver = require('semver');

const killable = require('killable');

const del = require('del');
const chokidar = require('chokidar');

const express = require('express');

const compress = require('compression');
const serveIndex = require('serve-index');
const httpProxyMiddleware = require('http-proxy-middleware');
const historyApiFallback = require('connect-history-api-fallback');

const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');

const createLogger = require('./utils/createLogger');
const createCertificate = require('./utils/createCertificate');

const validateOptions = require('schema-utils');
const schema = require('./options.json');

// Workaround for sockjs@~0.3.19
// sockjs will remove Origin header, however Origin header is required for checking host.
// See https://github.com/webpack/webpack-dev-server/issues/1604 for more information
{
  // eslint-disable-next-line global-require
  const SockjsSession = require('sockjs/lib/transport').Session;
  const decorateConnection = SockjsSession.prototype.decorateConnection;
  SockjsSession.prototype.decorateConnection = function(req) {
    decorateConnection.call(this, req);
    const connection = this.connection;
    if (connection.headers && !('origin' in connection.headers) && 'origin' in req.headers) {
      connection.headers.origin = req.headers.origin;
    }
  };
}

// Workaround for node ^8.6.0, ^9.0.0
// DEFAULT_ECDH_CURVE is default to prime256v1 in these version
// breaking connection when certificate is not signed with prime256v1
// change it to auto allows OpenSSL to select the curve automatically
// See https://github.com/nodejs/node/issues/16196 for more infomation
if (semver.satisfies(process.version, '8.6.0 - 9')) {
  tls.DEFAULT_ECDH_CURVE = 'auto';
}

const STATS = {
  all: false,
  hash: true,
  assets: true,
  warnings: true,
  errors: true,
  errorDetails: false
};

function Server (compiler, options = {}, _log) {
  this.log = _log || createLogger(options);

  validateOptions(schema, options, 'webpack Dev Server');

  if (options.lazy && !options.filename) {
    throw new Error("'filename' option must be set in lazy mode.");
  }

  this.hot = options.hot || options.hotOnly;
  this.headers = options.headers;
  this.progress = options.progress;

  this.clientOverlay = options.overlay;
  this.clientLogLevel = options.clientLogLevel;

  this.publicHost = options.public;
  this.allowedHosts = options.allowedHosts;
  this.disableHostCheck = !!options.disableHostCheck;

  this.sockets = [];

  this.watchOptions = options.watchOptions || {};
  this.contentBaseWatchers = [];

  // Listening for events
  const invalidPlugin = () => {
    this.sockWrite(this.sockets, 'invalid');
  };

  if (this.progress) {
    const progressPlugin = new webpack.ProgressPlugin(
      (percent, msg, addInfo) => {
        percent = Math.floor(percent * 100);

        if (percent === 100) {
          msg = 'Compilation completed';
        }

        if (addInfo) {
          msg = `${msg} (${addInfo})`;
        }

        this.sockWrite(this.sockets, 'progress-update', { percent, msg });
      }
    );

    progressPlugin.apply(compiler);
  }

  const addHooks = (compiler) => {
    const { compile, invalid, done } = compiler.hooks;

    compile.tap('webpack-dev-server', invalidPlugin);
    invalid.tap('webpack-dev-server', invalidPlugin);
    done.tap('webpack-dev-server', (stats) => {
      this._sendStats(this.sockets, stats.toJson(STATS));
      this._stats = stats;
    });
  };

  if (compiler.compilers) {
    compiler.compilers.forEach(addHooks);
  } else {
    addHooks(compiler);
  }

  // Init express server
  // eslint-disable-next-line
  const app = this.app = new express();

  // ref: https://github.com/webpack/webpack-dev-server/issues/1575
  // remove this when send@^0.16.3
  express.static.mime.types.wasm = 'application/wasm';

  app.all('*', (req, res, next) => {
    if (this.checkHost(req.headers)) {
      return next();
    }

    res.send('Invalid Host header');
  });

  const wdmOptions = { logLevel: this.log.options.level };

  // middleware for serving webpack bundle
  this.middleware = webpackDevMiddleware(compiler, Object.assign({}, options, wdmOptions));

  app.get('/__webpack_dev_server__/live.bundle.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');

    fs.createReadStream(
      path.join(__dirname, '..', 'client', 'live.bundle.js')
    ).pipe(res);
  });

  app.get('/__webpack_dev_server__/sockjs.bundle.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');

    fs.createReadStream(
      path.join(__dirname, '..', 'client', 'sockjs.bundle.js')
    ).pipe(res);
  });

  app.get('/webpack-dev-server.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');

    fs.createReadStream(
      path.join(__dirname, '..', 'client', 'index.bundle.js')
    ).pipe(res);
  });

  app.get('/webpack-dev-server/*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');

    fs.createReadStream(
      path.join(__dirname, '..', 'client', 'live.html')
    ).pipe(res);
  });

  app.get('/webpack-dev-server', (req, res) => {
    res.setHeader('Content-Type', 'text/html');

    res.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>'
    );

    const outputPath = this.middleware.getFilenameFromUrl(
      options.publicPath || '/'
    );

    const filesystem = this.middleware.fileSystem;

    function writeDirectory(baseUrl, basePath) {
      const content = filesystem.readdirSync(basePath);

      res.write('<ul>');

      content.forEach((item) => {
        const p = `${basePath}/${item}`;

        if (filesystem.statSync(p).isFile()) {
          res.write('<li><a href="');
          res.write(baseUrl + item);
          res.write('">');
          res.write(item);
          res.write('</a></li>');

          if (/\.js$/.test(item)) {
            const html = item.substr(0, item.length - 3);

            res.write('<li><a href="');
            res.write(baseUrl + html);
            res.write('">');
            res.write(html);
            res.write('</a> (magic html for ');
            res.write(item);
            res.write(') (<a href="');
            res.write(
              baseUrl.replace(
                // eslint-disable-next-line
                /(^(https?:\/\/[^\/]+)?\/)/,
                '$1webpack-dev-server/'
              ) + html
            );
            res.write('">webpack-dev-server</a>)</li>');
          }
        } else {
          res.write('<li>');
          res.write(item);
          res.write('<br>');

          writeDirectory(`${baseUrl + item}/`, p);

          res.write('</li>');
        }
      });

      res.write('</ul>');
    }

    writeDirectory(options.publicPath || '/', outputPath);

    res.end('</body></html>');
  });

  let contentBase;

  if (options.contentBase !== undefined) {
    contentBase = options.contentBase;
  } else {
    contentBase = process.cwd();
  }

  // Keep track of websocket proxies for external websocket upgrade.
  const websocketProxies = [];

  const features = {
    compress: () => {
      if (options.compress) {
        // Enable gzip compression.
        app.use(compress());
      }
    },
    proxy: () => {
      if (options.proxy) {
        /**
          * Assume a proxy configuration specified as:
          * proxy: {
          *   'context': { options }
          * }
          * OR
          * proxy: {
          *   'context': 'target'
          * }
          */
        if (!Array.isArray(options.proxy)) {
          options.proxy = Object.keys(options.proxy).map((context) => {
            let proxyOptions;
            // For backwards compatibility reasons.
            const correctedContext = context
              .replace(/^\*$/, '**')
              .replace(/\/\*$/, '');

            if (typeof options.proxy[context] === 'string') {
              proxyOptions = {
                context: correctedContext,
                target: options.proxy[context]
              };
            } else {
              proxyOptions = Object.assign({}, options.proxy[context]);
              proxyOptions.context = correctedContext;
            }

            proxyOptions.logLevel = proxyOptions.logLevel || 'warn';

            return proxyOptions;
          });
        }

        const getProxyMiddleware = (proxyConfig) => {
          const context = proxyConfig.context || proxyConfig.path;
          // It is possible to use the `bypass` method without a `target`.
          // However, the proxy middleware has no use in this case, and will fail to instantiate.
          if (proxyConfig.target) {
            return httpProxyMiddleware(context, proxyConfig);
          }
        };
        /**
        * Assume a proxy configuration specified as:
        * proxy: [
        *   {
        *     context: ...,
        *     ...options...
        *   },
        *   // or:
        *   function() {
        *     return {
        *       context: ...,
        *       ...options...
        *     };
        *   }
        * ]
        */
        options.proxy.forEach((proxyConfigOrCallback) => {
          let proxyConfig;
          let proxyMiddleware;

          if (typeof proxyConfigOrCallback === 'function') {
            proxyConfig = proxyConfigOrCallback();
          } else {
            proxyConfig = proxyConfigOrCallback;
          }

          proxyMiddleware = getProxyMiddleware(proxyConfig);

          if (proxyConfig.ws) {
            websocketProxies.push(proxyMiddleware);
          }

          app.use((req, res, next) => {
            if (typeof proxyConfigOrCallback === 'function') {
              const newProxyConfig = proxyConfigOrCallback();

              if (newProxyConfig !== proxyConfig) {
                proxyConfig = newProxyConfig;
                proxyMiddleware = getProxyMiddleware(proxyConfig);
              }
            }

            const bypass = typeof proxyConfig.bypass === 'function';

            const bypassUrl = (bypass && proxyConfig.bypass(req, res, proxyConfig)) || false;

            if (bypassUrl) {
              req.url = bypassUrl;

              next();
            } else if (proxyMiddleware) {
              return proxyMiddleware(req, res, next);
            } else {
              next();
            }
          });
        });
      }
    },
    historyApiFallback: () => {
      if (options.historyApiFallback) {
        const fallback = typeof options.historyApiFallback === 'object'
          ? options.historyApiFallback
          : null;
        // Fall back to /index.html if nothing else matches.
        app.use(historyApiFallback(fallback));
      }
    },
    contentBaseFiles: () => {
      if (Array.isArray(contentBase)) {
        contentBase.forEach((item) => {
          app.get('*', express.static(item));
        });
      } else if (/^(https?:)?\/\//.test(contentBase)) {
        this.log.warn(
          'Using a URL as contentBase is deprecated and will be removed in the next major version. Please use the proxy option instead.'
        );

        this.log.warn(
          'proxy: {\n\t"*": "<your current contentBase configuration>"\n}'
        );
        // Redirect every request to contentBase
        app.get('*', (req, res) => {
          res.writeHead(302, {
            Location: contentBase + req.path + (req._parsedUrl.search || '')
          });

          res.end();
        });
      } else if (typeof contentBase === 'number') {
        this.log.warn(
          'Using a number as contentBase is deprecated and will be removed in the next major version. Please use the proxy option instead.'
        );

        this.log.warn(
          'proxy: {\n\t"*": "//localhost:<your current contentBase configuration>"\n}'
        );
        // Redirect every request to the port contentBase
        app.get('*', (req, res) => {
          res.writeHead(302, {
            Location: `//localhost:${contentBase}${req.path}${req._parsedUrl.search || ''}`
          });

          res.end();
        });
      } else {
        // route content request
        app.get('*', express.static(contentBase, options.staticOptions));
      }
    },
    contentBaseIndex: () => {
      if (Array.isArray(contentBase)) {
        contentBase.forEach((item) => {
          app.get('*', serveIndex(item));
        });
      } else if (
        !/^(https?:)?\/\//.test(contentBase) &&
        typeof contentBase !== 'number'
      ) {
        app.get('*', serveIndex(contentBase));
      }
    },
    watchContentBase: () => {
      if (
        /^(https?:)?\/\//.test(contentBase) ||
        typeof contentBase === 'number'
      ) {
        throw new Error('Watching remote files is not supported.');
      } else if (Array.isArray(contentBase)) {
        contentBase.forEach((item) => {
          this._watch(item);
        });
      } else {
        this._watch(contentBase);
      }
    },
    before: () => {
      if (typeof options.before === 'function') {
        options.before(app, this);
      }
    },
    middleware: () => {
      // include our middleware to ensure
      // it is able to handle '/index.html' request after redirect
      app.use(this.middleware);
    },
    after: () => {
      if (typeof options.after === 'function') {
        options.after(app, this);
      }
    },
    headers: () => {
      app.all('*', this.setContentHeaders.bind(this));
    },
    magicHtml: () => {
      app.get('*', this.serveMagicHtml.bind(this));
    },
    setup: () => {
      if (typeof options.setup === 'function') {
        this.log.warn(
          'The `setup` option is deprecated and will be removed in v3. Please update your config to use `before`'
        );

        options.setup(app, this);
      }
    }
  };

  const defaultFeatures = [
    'setup',
    'before',
    'headers',
    'middleware'
  ];

  if (options.proxy) {
    defaultFeatures.push('proxy', 'middleware');
  }

  if (contentBase !== false) {
    defaultFeatures.push('contentBaseFiles');
  }

  if (options.watchContentBase) {
    defaultFeatures.push('watchContentBase');
  }

  if (options.historyApiFallback) {
    defaultFeatures.push('historyApiFallback', 'middleware');

    if (contentBase !== false) {
      defaultFeatures.push('contentBaseFiles');
    }
  }

  defaultFeatures.push('magicHtml');

  if (contentBase !== false) {
    defaultFeatures.push('contentBaseIndex');
  }
  // compress is placed last and uses unshift so that it will be the first middleware used
  if (options.compress) {
    defaultFeatures.unshift('compress');
  }

  if (options.after) {
    defaultFeatures.push('after');
  }

  (options.features || defaultFeatures).forEach((feature) => {
    features[feature]();
  });

  if (options.https) {
    // for keep supporting CLI parameters
    if (typeof options.https === 'boolean') {
      options.https = {
        ca: options.ca,
        pfx: options.pfx,
        key: options.key,
        cert: options.cert,
        passphrase: options.pfxPassphrase,
        requestCert: options.requestCert || false
      };
    }

    let fakeCert;

    if (!options.https.key || !options.https.cert) {
      // Use a self-signed certificate if no certificate was configured.
      // Cycle certs every 24 hours
      const certPath = path.join(__dirname, '../ssl/server.pem');

      let certExists = fs.existsSync(certPath);

      if (certExists) {
        const certTtl = 1000 * 60 * 60 * 24;
        const certStat = fs.statSync(certPath);

        const now = new Date();

        // cert is more than 30 days old, kill it with fire
        if ((now - certStat.ctime) / certTtl > 30) {
          this.log.info('SSL Certificate is more than 30 days old. Removing.');

          del.sync([certPath], { force: true });

          certExists = false;
        }
      }

      if (!certExists) {
        this.log.info('Generating SSL Certificate');

        const attrs = [
          { name: 'commonName', value: 'localhost' }
        ];

        const pems = createCertificate(attrs);

        fs.writeFileSync(
          certPath,
          pems.private + pems.cert,
          { encoding: 'utf-8' }
        );
      }

      fakeCert = fs.readFileSync(certPath);
    }

    options.https.key = options.https.key || fakeCert;
    options.https.cert = options.https.cert || fakeCert;

    if (!options.https.spdy) {
      options.https.spdy = {
        protocols: ['h2', 'http/1.1']
      };
    }

    // `spdy` is effectively unmaintained, and as a consequence of an
    // implementation that extensively relies on Node’s non-public APIs, broken
    // on Node 10 and above. In those cases, only https will be used for now.
    // Once express supports Node's built-in HTTP/2 support, migrating over to
    // that should be the best way to go.
    // The relevant issues are:
    // - https://github.com/nodejs/node/issues/21665
    // - https://github.com/webpack/webpack-dev-server/issues/1449
    // - https://github.com/expressjs/express/issues/3388
    if (semver.gte(process.version, '10.0.0')) {
      this.listeningApp = https.createServer(options.https, app);
    } else {
      this.listeningApp = spdy.createServer(options.https, app);
    }
  } else {
    this.listeningApp = http.createServer(app);
  }

  killable(this.listeningApp);

  // Proxy websockets without the initial http request
  // https://github.com/chimurai/http-proxy-middleware#external-websocket-upgrade
  websocketProxies.forEach(function (wsProxy) {
    this.listeningApp.on('upgrade', wsProxy.upgrade);
  }, this);
}

Server.prototype.use = function () {
  // eslint-disable-next-line
  this.app.use.apply(this.app, arguments);
};

Server.prototype.setContentHeaders = function (req, res, next) {
  if (this.headers) {
    for (const name in this.headers) { // eslint-disable-line
      res.setHeader(name, this.headers[name]);
    }
  }

  next();
};

Server.prototype.checkHost = function (headers, headerToCheck) {
  // allow user to opt-out this security check, at own risk
  if (this.disableHostCheck) {
    return true;
  }

  if (!headerToCheck) headerToCheck = 'host';
  // get the Host header and extract hostname
  // we don't care about port not matching
  const hostHeader = headers[headerToCheck];

  if (!hostHeader) {
    return false;
  }

  // use the node url-parser to retrieve the hostname from the host-header.
  const hostname = url.parse(
    // if hostHeader doesn't have scheme, add // for parsing.
    /^(.+:)?\/\//.test(hostHeader) ? hostHeader : `//${hostHeader}`,
    false,
    true
  ).hostname;
  // always allow requests with explicit IPv4 or IPv6-address.
  // A note on IPv6 addresses:
  // hostHeader will always contain the brackets denoting
  // an IPv6-address in URLs,
  // these are removed from the hostname in url.parse(),
  // so we have the pure IPv6-address in hostname.
  if (ip.isV4Format(hostname) || ip.isV6Format(hostname)) {
    return true;
  }
  // always allow localhost host, for convience
  if (hostname === 'localhost') {
    return true;
  }
  // allow if hostname is in allowedHosts
  if (this.allowedHosts && this.allowedHosts.length) {
    for (let hostIdx = 0; hostIdx < this.allowedHosts.length; hostIdx++) {
      const allowedHost = this.allowedHosts[hostIdx];

      if (allowedHost === hostname) return true;

      // support "." as a subdomain wildcard
      // e.g. ".example.com" will allow "example.com", "www.example.com", "subdomain.example.com", etc
      if (allowedHost[0] === '.') {
        // "example.com"
        if (hostname === allowedHost.substring(1)) {
          return true;
        }
        // "*.example.com"
        if (hostname.endsWith(allowedHost)) {
          return true;
        }
      }
    }
  }

  // allow hostname of listening adress
  if (hostname === this.hostname) {
    return true;
  }

  // also allow public hostname if provided
  if (typeof this.publicHost === 'string') {
    const idxPublic = this.publicHost.indexOf(':');

    const publicHostname = idxPublic >= 0
      ? this.publicHost.substr(0, idxPublic)
      : this.publicHost;

    if (hostname === publicHostname) {
      return true;
    }
  }

  // disallow
  return false;
};

// delegate listen call and init sockjs
Server.prototype.listen = function (port, hostname, fn) {
  this.hostname = hostname;

  const returnValue = this.listeningApp.listen(port, hostname, (err) => {
    const socket = sockjs.createServer({
      // Use provided up-to-date sockjs-client
      sockjs_url: '/__webpack_dev_server__/sockjs.bundle.js',
      // Limit useless logs
      log: (severity, line) => {
        if (severity === 'error') {
          this.log.error(line);
        } else {
          this.log.debug(line);
        }
      }
    });

    socket.on('connection', (connection) => {
      if (!connection) {
        return;
      }

      if (!this.checkHost(connection.headers) || !this.checkHost(connection.headers, 'origin')) {
        this.sockWrite([ connection ], 'error', 'Invalid Host/Origin header');

        connection.close();

        return;
      }

      this.sockets.push(connection);

      connection.on('close', () => {
        const idx = this.sockets.indexOf(connection);

        if (idx >= 0) {
          this.sockets.splice(idx, 1);
        }
      });

      if (this.hot) {
        this.sockWrite([ connection ], 'hot');
      }

      if (this.progress) {
        this.sockWrite([ connection ], 'progress', this.progress);
      }

      if (this.clientOverlay) {
        this.sockWrite([ connection ], 'overlay', this.clientOverlay);
      }

      if (this.clientLogLevel) {
        this.sockWrite([ connection ], 'log-level', this.clientLogLevel);
      }

      if (!this._stats) {
        return;
      }

      this._sendStats([ connection ], this._stats.toJson(STATS), true);
    });

    socket.installHandlers(this.listeningApp, {
      prefix: '/sockjs-node'
    });

    if (fn) {
      fn.call(this.listeningApp, err);
    }
  });

  return returnValue;
};

Server.prototype.close = function (cb) {
  this.sockets.forEach((socket) => {
    socket.close();
  });

  this.sockets = [];

  this.contentBaseWatchers.forEach((watcher) => {
    watcher.close();
  });

  this.contentBaseWatchers = [];

  this.listeningApp.kill(() => {
    this.middleware.close(cb);
  });
};

Server.prototype.sockWrite = function (sockets, type, data) {
  sockets.forEach((socket) => {
    socket.write(
      JSON.stringify({ type, data })
    );
  });
};

Server.prototype.serveMagicHtml = function (req, res, next) {
  const _path = req.path;

  try {
    const isFile = this.middleware.fileSystem.statSync(
      this.middleware.getFilenameFromUrl(`${_path}.js`)
    ).isFile();

    if (!isFile) {
      return next();
    }
    // Serve a page that executes the javascript
    res.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><script type="text/javascript" charset="utf-8" src="'
    );
    res.write(_path);
    res.write('.js');
    res.write(req._parsedUrl.search || '');

    res.end('"></script></body></html>');
  } catch (err) {
    return next();
  }
};

// send stats to a socket or multiple sockets
Server.prototype._sendStats = function (sockets, stats, force) {
  if (
    !force &&
    stats &&
    (!stats.errors || stats.errors.length === 0) &&
    stats.assets &&
    stats.assets.every(asset => !asset.emitted)
  ) {
    return this.sockWrite(sockets, 'still-ok');
  }

  this.sockWrite(sockets, 'hash', stats.hash);

  if (stats.errors.length > 0) {
    this.sockWrite(sockets, 'errors', stats.errors);
  } else if (stats.warnings.length > 0) {
    this.sockWrite(sockets, 'warnings', stats.warnings);
  } else {
    this.sockWrite(sockets, 'ok');
  }
};

Server.prototype._watch = function (watchPath) {
  // duplicate the same massaging of options that watchpack performs
  // https://github.com/webpack/watchpack/blob/master/lib/DirectoryWatcher.js#L49
  // this isn't an elegant solution, but we'll improve it in the future
  const usePolling = this.watchOptions.poll ? true : undefined;
  const interval = typeof this.watchOptions.poll === 'number'
    ? this.watchOptions.poll
    : undefined;

  const options = {
    ignoreInitial: true,
    persistent: true,
    followSymlinks: false,
    depth: 0,
    atomic: false,
    alwaysStat: true,
    ignorePermissionErrors: true,
    ignored: this.watchOptions.ignored,
    usePolling,
    interval
  };

  const watcher = chokidar.watch(watchPath, options);

  watcher.on('change', () => {
    this.sockWrite(this.sockets, 'content-changed');
  });

  this.contentBaseWatchers.push(watcher);
};

Server.prototype.invalidate = function () {
  if (this.middleware) {
    this.middleware.invalidate();
  }
};

// Export this logic,
// so that other implementations,
// like task-runners can use it
Server.addDevServerEntrypoints = require('./utils/addEntries');

module.exports = Server;
