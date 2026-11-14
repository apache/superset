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

/**
 * End-to-end tests of the in-band authentication state machine over real
 * WebSocket connections on a loopback port: pending_auth -> authenticated,
 * in-band refresh, and the close codes that tell a client what to do next.
 */
import jwt from 'jsonwebtoken';
import * as http from 'http';
import { duplexPair, type Duplex } from 'stream';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import config from '../config.test.json' with { type: 'json' };
import * as server from '../src/index';

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(function () {
    return { subscribe: vi.fn(), on: vi.fn() };
  }),
}));

type Frame = { topic: string; payload: Record<string, unknown> };

const signTicket = (
  channel = 'user:5',
  expiresInSeconds = 3600,
  secret = config.jwtSecret,
) =>
  jwt.sign(
    {
      channel,
      sub: channel.replace('user:', ''),
      principal_type: 'user',
      aud: 'superset-websocket',
      iss: 'superset',
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    },
    secret,
  );

// The server under test is driven over in-memory duplex streams rather than a
// TCP listener: the HTTP parser, the upgrade handshake and the WebSocket framing
// are all real, only the transport is a pipe.
let httpServer: http.Server;
const clients: WebSocket[] = [];
const serverStreams: Duplex[] = [];

/** Give a stream the socket methods `http` and `ws` call on their transport. */
const asSocket = (stream: Duplex): Duplex =>
  Object.assign(stream, {
    setTimeout: () => stream,
    setNoDelay: () => stream,
    setKeepAlive: () => stream,
    ref: () => stream,
    unref: () => stream,
    remoteAddress: '127.0.0.1',
  });

/** A client socket whose peer is the server under test. */
const connectToServer = (): Duplex => {
  const [clientSide, serverSide] = duplexPair();
  serverStreams.push(serverSide);
  httpServer.emit('connection', asSocket(serverSide));
  return asSocket(clientSide);
};

const newClient = (
  options: ConstructorParameters<typeof WebSocket>[2] = {},
) => {
  const ws = new WebSocket('ws://localhost/', {
    createConnection: () => connectToServer() as never,
    ...options,
  });
  clients.push(ws);
  return ws;
};

beforeAll(() => {
  httpServer = http.createServer();
  httpServer.on('upgrade', server.httpUpgrade);
});

beforeEach(async () => {
  // Close the previous test's connections on both ends and let their
  // server-side close handlers run before resetting, so a late release can't
  // decrement the freshly reset pending-connection count. Terminating a client
  // alone doesn't reach the server over the in-memory pipe.
  clients.splice(0).forEach(client => client.terminate());
  serverStreams.splice(0).forEach(stream => stream.destroy());
  await vi.waitFor(() => expect(server.pendingConnectionCount()).toBe(0));
  server.resetState();
});

afterAll(() => {
  clients.forEach(client => client.terminate());
});

/** Open a socket and buffer everything it receives, in order. */
const open = async () => {
  const ws = newClient();
  const frames: Frame[] = [];
  const closed = new Promise<{ code: number; reason: string }>(resolve => {
    ws.on('close', (code, reason) =>
      resolve({ code, reason: reason.toString() }),
    );
  });
  ws.on('message', data => frames.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  return { ws, frames, closed };
};

const authFrame = (token: string, tabId?: string) =>
  JSON.stringify({ type: 'auth', token, tab_id: tabId });

test('a new connection is pending_auth: registered on no channel', async () => {
  const { frames } = await open();

  await new Promise(resolve => setTimeout(resolve, 50));
  expect(frames).toEqual([]);
  expect(server.channels).toEqual({});
  expect(server.sockets).toEqual({});
});

test('routed messages reach no socket until it authenticates', async () => {
  const { ws, frames } = await open();
  const nudge = JSON.stringify({
    topic: 'entity.changed',
    scope: 'authenticated_global',
    payload: { entity_type: 'task', id: 'a' },
  });

  server.routeRedisMessage('realtime', nudge);
  ws.send(authFrame(signTicket()));
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  server.routeRedisMessage('realtime', nudge);
  await vi.waitFor(() => expect(frames).toHaveLength(2));

  expect(frames[0].topic).toBe('realtime.auth');
  expect(frames[1].topic).toBe('entity.changed');
});

test('the first valid auth frame binds the principal and tab channels', async () => {
  const { ws, frames } = await open();

  ws.send(authFrame(signTicket('user:5', 600), 'tab3'));
  await vi.waitFor(() => expect(frames).toHaveLength(1));

  expect(frames[0]).toEqual({
    topic: 'realtime.auth',
    payload: { status: 'ok', expires_in: expect.any(Number) },
  });
  expect(frames[0].payload.expires_in).toBeGreaterThan(590);
  expect(frames[0].payload.expires_in).toBeLessThanOrEqual(600);
  expect(server.channels['user:5'].sockets).toHaveLength(1);
  expect(server.channels['user:5:tab3'].sockets).toEqual(
    server.channels['user:5'].sockets,
  );
});

test('a refresh extends the expiry on the open socket without reconnecting', async () => {
  const { ws, frames } = await open();
  ws.send(authFrame(signTicket('user:5', 60)));
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  const [socketId] = Object.keys(server.sockets);
  const before = server.sockets[socketId].identity.tokenExpiresAtMs;

  ws.send(authFrame(signTicket('user:5', 3600)));
  await vi.waitFor(() => expect(frames).toHaveLength(2));

  expect(frames[1].payload.expires_in).toBeGreaterThan(3500);
  expect(Object.keys(server.sockets)).toEqual([socketId]);
  expect(server.sockets[socketId].identity.tokenExpiresAtMs).toBeGreaterThan(
    before,
  );
  expect(ws.readyState).toBe(WebSocket.OPEN);
});

test('a refresh with a changed tab_id rebinds the tab channel', async () => {
  const { ws, frames } = await open();
  ws.send(authFrame(signTicket(), 'old'));
  await vi.waitFor(() => expect(frames).toHaveLength(1));

  ws.send(authFrame(signTicket(), 'new'));
  await vi.waitFor(() => expect(frames).toHaveLength(2));

  expect(server.channels['user:5:old']).toBeUndefined();
  expect(server.channels['user:5:new'].sockets).toEqual(
    server.channels['user:5'].sockets,
  );
});

test('a refresh without a tab_id keeps the existing tab binding', async () => {
  const { ws, frames } = await open();
  ws.send(authFrame(signTicket(), 'tab3'));
  await vi.waitFor(() => expect(frames).toHaveLength(1));

  ws.send(authFrame(signTicket()));
  await vi.waitFor(() => expect(frames).toHaveLength(2));

  expect(server.channels['user:5:tab3'].sockets).toHaveLength(1);
});

test('a refresh naming another principal closes the socket with 4403', async () => {
  const { ws, frames, closed } = await open();
  ws.send(authFrame(signTicket('user:5')));
  await vi.waitFor(() => expect(frames).toHaveLength(1));

  ws.send(authFrame(signTicket('user:6')));

  expect(await closed).toEqual({ code: 4403, reason: 'principal mismatch' });
});

test('a refresh ack over the send buffer cap terminates the socket', async () => {
  const { ws, frames } = await open();
  ws.send(authFrame(signTicket()));
  await vi.waitFor(() => expect(frames).toHaveLength(1));
  const [socketId] = Object.keys(server.sockets);
  const serverWs = server.sockets[socketId].ws;
  vi.spyOn(serverWs, 'bufferedAmount', 'get').mockReturnValue(2048);
  const sendSpy = vi.spyOn(serverWs, 'send');
  const terminateSpy = vi.spyOn(serverWs, 'terminate');
  server.opts.maxSocketBufferBytes = 1024;

  try {
    ws.send(authFrame(signTicket()));

    await vi.waitFor(() => expect(terminateSpy).toHaveBeenCalled());
    expect(sendSpy).not.toHaveBeenCalled();
    expect(server.sockets).toEqual({});
  } finally {
    server.opts.maxSocketBufferBytes = 0;
  }
});

test.each([
  [
    'signed with an unknown secret',
    () => signTicket('user:5', 60, 'x'.repeat(40)),
  ],
  ['already expired', () => signTicket('user:5', -5)],
])('a ticket %s closes the socket with 4401', async (_label, makeToken) => {
  const { ws, closed } = await open();

  ws.send(authFrame(makeToken()));

  expect(await closed).toEqual({ code: 4401, reason: 'invalid token' });
  expect(server.channels).toEqual({});
});

test('frames that are not auth frames are ignored', async () => {
  const { ws, frames } = await open();

  ws.send('not json');
  ws.send(JSON.stringify({ type: 'ping' }));
  ws.send(JSON.stringify({ type: 'auth' }));
  ws.send(authFrame(signTicket()));
  await vi.waitFor(() => expect(frames).toHaveLength(1));

  expect(frames[0].topic).toBe('realtime.auth');
});

test('an upgrade from a disallowed origin is answered with 403', async () => {
  server.opts.allowedOrigins = ['https://superset.example.com'];
  try {
    const ws = newClient({ origin: 'https://evil.example' });

    const status = await new Promise<number | undefined>(resolve => {
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
      ws.on('error', () => {});
    });

    expect(status).toBe(403);
  } finally {
    server.opts.allowedOrigins = [];
  }
});

test('an upgrade while the subscriber is unhealthy is answered with 503', async () => {
  server.markSubscriberUnhealthy('test drop');
  const ws = newClient();

  const status = await new Promise<number | undefined>(resolve => {
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
    ws.on('error', () => {});
  });

  expect(status).toBe(503);
});

test('unauthenticated sockets count toward maxTotalConnections', async () => {
  server.opts.maxTotalConnections = 1;
  try {
    await open();
    expect(server.pendingConnectionCount()).toBe(1);

    const second = await open();

    expect(await second.closed).toMatchObject({ code: 1013 });
  } finally {
    server.opts.maxTotalConnections = 0;
  }
});

test('maxPendingConnections caps unauthenticated sockets separately', async () => {
  server.opts.maxPendingConnections = 1;
  try {
    const first = await open();
    const second = await open();
    expect(await second.closed).toMatchObject({ code: 1013 });

    // Authenticating releases the reservation for the next connection.
    first.ws.send(authFrame(signTicket()));
    await vi.waitFor(() => expect(first.frames).toHaveLength(1));
    expect(server.pendingConnectionCount()).toBe(0);
    const third = await open();
    third.ws.send(authFrame(signTicket()));
    await vi.waitFor(() => expect(third.frames).toHaveLength(1));
  } finally {
    server.opts.maxPendingConnections = 0;
  }
});

test('a pending socket releases its reservation when it closes', async () => {
  const { ws, closed } = await open();
  expect(server.pendingConnectionCount()).toBe(1);

  ws.close();
  await closed;

  expect(server.pendingConnectionCount()).toBe(0);
});

test('auth is refused when the subscriber dropped after the upgrade', async () => {
  const { ws, closed } = await open();
  server.markSubscriberUnhealthy('test drop');

  ws.send(authFrame(signTicket()));

  expect(await closed).toMatchObject({ code: 1012 });
  expect(server.channels).toEqual({});
  expect(server.sockets).toEqual({});
});
