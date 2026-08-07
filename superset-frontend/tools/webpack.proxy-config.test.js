/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const http = require('http');
const zlib = require('zlib');
const { ZSTDCompress } = require('simple-zstd');
const { createProxyMiddleware } = require('http-proxy-middleware');

// yargs ships ESM-only and jest's default transform doesn't cover
// node_modules; webpack.proxy-config.js only uses it to parse a `--env`
// CLI flag we don't exercise here (the target port is set via
// process.env.supersetPort below), so stub it out rather than teaching
// the whole suite's transformIgnorePatterns about it.
jest.mock('yargs', () => jest.fn(() => ({ parse: () => ({}) })));
jest.mock('yargs/helpers', () => ({ hideBin: argv => argv }));

const HANG_GUARD_MS = 2000;

/**
 * Wires the real dev proxy config to a real HTTP server, exactly the way
 * webpack-dev-server does (`devServer.proxy: [() => proxyConfig]`), and
 * points it at a caller-supplied backend. Both servers are ephemeral
 * (port 0) so tests can run in parallel.
 */
async function startProxy(backendPort) {
  const previousPort = process.env.supersetPort;
  // webpack.proxy-config.js resolves its target port from process.env at
  // require()-time, so the module must be (re-)required after this is set.
  process.env.supersetPort = String(backendPort);
  jest.resetModules();
  // eslint-disable-next-line global-require
  const getProxyConfig = require('../webpack.proxy-config');
  process.env.supersetPort = previousPort;

  const proxyMiddleware = createProxyMiddleware(getProxyConfig(undefined));
  const server = http.createServer((req, res) => proxyMiddleware(req, res));
  await new Promise(resolve => server.listen(0, resolve));
  return server;
}

async function startBackend(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, resolve));
  return server;
}

function get(port, path = '/dashboard/list/') {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port, path }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString(),
        }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function closeAll(...servers) {
  await Promise.all(
    servers.map(server => new Promise(resolve => server.close(resolve))),
  );
}

// simple-zstd only exposes streaming (de)compressors backed by the system
// zstd binary, not a buffer-in/buffer-out helper -- wrap ZSTDCompress so the
// tests below can compress a fixture in one call.
function compressBuffer(buffer, level = 3) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const compressor = ZSTDCompress(level);
    compressor.on('data', chunk => chunks.push(chunk));
    compressor.on('end', () => resolve(Buffer.concat(chunks)));
    compressor.on('error', reject);
    compressor.end(buffer);
  });
}

describe('webpack.proxy-config zstd/gzip HTML decompression', () => {
  test('decompresses a complete zstd-encoded HTML response and injects the [DEV] title', async () => {
    const html =
      '<html><head><title>Superset</title></head><body>hi</body></html>';
    const backend = await startBackend(async (req, res) => {
      const compressed = await compressBuffer(Buffer.from(html), 3);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-encoding': 'zstd',
      });
      res.end(compressed);
    });
    const proxy = await startProxy(backend.address().port);

    try {
      const { statusCode, body } = await get(proxy.address().port);
      expect(statusCode).toBe(200);
      expect(body).toContain('[DEV] Superset');
      expect(body).toContain('<body>hi</body>');
    } finally {
      await closeAll(proxy, backend);
    }
  });

  test(
    'fails fast instead of hanging when the backend connection drops mid-response (zstd)',
    async () => {
      const html = `<html><head><title>Superset</title></head><body>${'x'.repeat(20000)}</body></html>`;
      const backend = await startBackend(async (req, res) => {
        const compressed = await compressBuffer(Buffer.from(html), 3);
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'zstd',
        });
        // Simulate the backend dying mid-response -- e.g. the Flask dev
        // server's reloader restarting on a file save -- by writing only
        // half the compressed body and then hard-destroying the socket.
        // The short delay lets the proxy fully receive the response headers
        // first, so this exercises the body-stream-level failure inside
        // processHTML rather than a connection-level error that
        // http-proxy-middleware's own error handler would intercept first.
        res.write(compressed.subarray(0, Math.floor(compressed.length / 2)));
        setTimeout(() => res.socket.destroy(), 20);
      });
      const proxy = await startProxy(backend.address().port);

      let hangGuardTimer;
      try {
        const hangGuard = new Promise((_resolve, reject) => {
          hangGuardTimer = setTimeout(
            () =>
              reject(
                new Error(
                  'request never resolved -- the client-facing response hung ' +
                    'instead of the proxy propagating the backend disconnect',
                ),
              ),
            HANG_GUARD_MS,
          );
        });

        // Headers (including the 200 the backend sent before dying) are
        // already flushed before the drop is detected, so the response
        // completes with the original status; what matters is that it
        // completes at all, promptly, with the error surfaced in the body
        // instead of the connection hanging indefinitely.
        const { body } = await Promise.race([
          get(proxy.address().port),
          hangGuard,
        ]);
        expect(body).toContain('Error requesting');
      } finally {
        clearTimeout(hangGuardTimer);
        await closeAll(proxy, backend);
      }
    },
    HANG_GUARD_MS + 1000,
  );

  test(
    'fails fast instead of hanging when the backend connection drops mid-response (gzip)',
    async () => {
      // The hang is a generic pipe()-doesn't-propagate-errors bug in
      // processHTML, not specific to any one decoder -- pin it for gzip too.
      const html = `<html><head><title>Superset</title></head><body>${'x'.repeat(20000)}</body></html>`;
      const compressed = zlib.gzipSync(Buffer.from(html));
      const backend = await startBackend((req, res) => {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
        });
        res.write(compressed.subarray(0, Math.floor(compressed.length / 2)));
        setTimeout(() => res.socket.destroy(), 20);
      });
      const proxy = await startProxy(backend.address().port);

      let hangGuardTimer;
      try {
        const hangGuard = new Promise((_resolve, reject) => {
          hangGuardTimer = setTimeout(
            () =>
              reject(
                new Error(
                  'request never resolved -- the client-facing response hung ' +
                    'instead of the proxy propagating the backend disconnect',
                ),
              ),
            HANG_GUARD_MS,
          );
        });

        const { body } = await Promise.race([
          get(proxy.address().port),
          hangGuard,
        ]);
        expect(body).toContain('Error requesting');
      } finally {
        clearTimeout(hangGuardTimer);
        await closeAll(proxy, backend);
      }
    },
    HANG_GUARD_MS + 1000,
  );
});

describe('webpack.proxy-config generic (non-HTML) passthrough', () => {
  test(
    'fails fast instead of hanging when the backend connection drops mid-response (JSON)',
    async () => {
      // Dashboard/chart data requests (e.g. /api/v1/chart/data) go through
      // this generic passthrough branch, not processHTML -- pin the same
      // mid-stream-disconnect hang for it too.
      const json = `{"result": "${'x'.repeat(20000)}"}`;
      const backend = await startBackend((req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write(json.slice(0, Math.floor(json.length / 2)));
        setTimeout(() => res.socket.destroy(), 20);
      });
      const proxy = await startProxy(backend.address().port);

      let hangGuardTimer;
      try {
        const hangGuard = new Promise((_resolve, reject) => {
          hangGuardTimer = setTimeout(
            () =>
              reject(
                new Error(
                  'request never resolved -- the client-facing response hung ' +
                    'instead of the proxy propagating the backend disconnect',
                ),
              ),
            HANG_GUARD_MS,
          );
        });

        // Whether the truncated body surfaces as a client-side error or as
        // a short-but-well-framed response depends on transfer encoding --
        // what matters here is that the request settles promptly one way
        // or the other instead of hanging indefinitely.
        const settled = await Promise.race([
          get(proxy.address().port, '/api/v1/chart/data').catch(e => ({
            error: e.message,
          })),
          hangGuard,
        ]);
        expect(settled).toBeTruthy();
      } finally {
        clearTimeout(hangGuardTimer);
        await closeAll(proxy, backend);
      }
    },
    HANG_GUARD_MS + 1000,
  );
});
