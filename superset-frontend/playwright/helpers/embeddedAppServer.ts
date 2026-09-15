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
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { AddressInfo, Socket } from 'net';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The SDK bundle built from superset-embedded-sdk/. */
export const SDK_BUNDLE_PATH = join(
  __dirname,
  '../../../superset-embedded-sdk/bundle/index.js',
);

const INDEX_HTML_PATH = join(__dirname, '../embedded-app/index.html');

export interface EmbedAppServer {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

/**
 * Start the static embedded test app on an OS-assigned ephemeral port, so
 * workers and retries never collide. Serves only its index.html and the SDK
 * bundle. Open sockets are tracked so close() does not hang on iframe
 * keep-alive connections.
 */
export async function startEmbedAppServer(): Promise<EmbedAppServer> {
  const sockets = new Set<Socket>();
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const urlPath = req.url?.split('?')[0] || '/';

    if (urlPath === '/sdk/index.js') {
      if (!existsSync(SDK_BUNDLE_PATH)) {
        res.writeHead(404);
        res.end(
          'SDK bundle not found. Run: cd superset-embedded-sdk && npm ci && npm run build',
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(readFileSync(SDK_BUNDLE_PATH));
      return;
    }

    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(INDEX_HTML_PATH));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>(resolve => {
        for (const socket of sockets) socket.destroy();
        sockets.clear();
        server.close(() => resolve());
      }),
  };
}
