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

import jwt from 'jsonwebtoken';
import config from '../config.test.json' with { type: 'json' };
import {
  describe,
  expect,
  test,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import * as http from 'http';
import * as net from 'net';
import { WebSocket } from 'ws';
import * as server from '../src/index';
import { statsd } from '../src/index';

const { mockSubscribe, mockOn } = vi.hoisted(() => {
  return { mockSubscribe: vi.fn(), mockOn: vi.fn() };
});

vi.mock('ws');
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(function () {
      return { subscribe: mockSubscribe, on: mockOn };
    }),
  };
});

const wsMock = WebSocket as unknown as Mock<typeof WebSocket>;
const channelId = 'user:5';

// An override of `undefined` means "this claim is absent" - the key is dropped
// rather than signed as undefined, which `jsonwebtoken` rejects outright for
// registered claims such as `exp`.
const realtimeClaims = (overrides: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries({
      channel: channelId,
      sub: '5',
      principal_type: 'user',
      aud: 'superset-websocket',
      iss: 'superset',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    }).filter(([, value]) => value !== undefined),
  );

const signRealtimeToken = (
  overrides: Record<string, unknown> = {},
  secret = config.jwtSecret,
) => jwt.sign(realtimeClaims(overrides), secret);

/**
 * Build an upgrade-shaped HTTP request, optionally carrying the JWT cookie and
 * an `Origin` header.
 */
const makeRequest = ({
  token,
  origin,
  url = 'http://localhost',
}: {
  token?: string;
  origin?: string;
  url?: string;
} = {}): http.IncomingMessage => {
  const request = new http.IncomingMessage(new net.Socket());
  request.method = 'GET';
  request.url = url;
  if (token) request.headers.cookie = `${config.jwtCookieName}=${token}`;
  if (origin) request.headers.origin = origin;
  return request;
};

/** The identity a socket on `channel` would have proven at upgrade time. */
const makeIdentity = (
  channel: string,
  tokenExpiresAtMs = Date.now() + 3600 * 1000,
): server.SocketIdentity =>
  channel.startsWith('guest:')
    ? { channel, principalType: 'guest', subject: channel, tokenExpiresAtMs }
    : {
        channel,
        principalType: 'user',
        subject: channel.replace('user:', ''),
        tokenExpiresAtMs,
      };

/** Register an already-authenticated socket on `channel`. */
const trackSocket = (
  channel: string,
  ws: WebSocket,
  overrides: Partial<server.SocketInstance> = {},
): string =>
  server.trackClient(channel, {
    ws,
    channel,
    identity: makeIdentity(channel),
    pongTs: Date.now(),
    ...overrides,
  });

/** Run the full accept path for `token`: verify at upgrade, then connect. */
const connect = (ws: WebSocket, token: string) =>
  server.wsConnection(ws, server.readSocketIdentity(makeRequest({ token })));

describe('server', () => {
  let statsdIncrementMock: Mock<typeof statsd.increment>;

  beforeEach(() => {
    server.resetState();
    statsdIncrementMock = vi.spyOn(statsd, 'increment').mockReturnValue();
  });

  afterEach(() => {
    statsdIncrementMock.mockRestore();
  });

  describe('HTTP requests', () => {
    test('services health checks', () => {
      const endMock = vi.fn();
      const writeHeadMock = vi.fn();

      const request = {
        url: '/health',
        method: 'GET',
        headers: {
          host: 'example.com',
        },
      };

      const response = {
        writeHead: writeHeadMock,
        end: endMock,
      };

      server.httpRequest(
        request as unknown as http.IncomingMessage,
        response as unknown as http.ServerResponse<http.IncomingMessage>,
      );

      expect(writeHeadMock).toHaveBeenCalledTimes(1);
      expect(writeHeadMock).toHaveBeenLastCalledWith(200);

      expect(endMock).toHaveBeenCalledTimes(1);
      expect(endMock).toHaveBeenLastCalledWith('OK');
    });

    test('responds with a 404 when not found', () => {
      const endMock = vi.fn();
      const writeHeadMock = vi.fn();

      const request = {
        url: '/unsupported',
        method: 'GET',
        headers: {
          host: 'example.com',
        },
      };

      const response = {
        writeHead: writeHeadMock,
        end: endMock,
      };

      server.httpRequest(
        request as unknown as http.IncomingMessage,
        response as unknown as http.ServerResponse<http.IncomingMessage>,
      );

      expect(writeHeadMock).toHaveBeenCalledTimes(1);
      expect(writeHeadMock).toHaveBeenLastCalledWith(404);

      expect(endMock).toHaveBeenCalledTimes(1);
      expect(endMock).toHaveBeenLastCalledWith('Not Found');
    });

    const readyResponse = () => {
      const endMock = vi.fn();
      const writeHeadMock = vi.fn();
      server.httpRequest(
        {
          url: '/ready',
          method: 'GET',
          headers: { host: 'example.com' },
        } as unknown as http.IncomingMessage,
        {
          writeHead: writeHeadMock,
          end: endMock,
        } as unknown as http.ServerResponse<http.IncomingMessage>,
      );
      return { writeHeadMock, endMock };
    };

    test('readiness is 200 while the subscriber is healthy', () => {
      // resetState() (beforeEach) leaves the server healthy.
      const { writeHeadMock } = readyResponse();
      expect(writeHeadMock).toHaveBeenLastCalledWith(200);
    });

    test('readiness is 503 while the subscriber is unhealthy', () => {
      server.markSubscriberUnhealthy('test drop');
      const { writeHeadMock, endMock } = readyResponse();
      expect(writeHeadMock).toHaveBeenLastCalledWith(503);
      expect(endMock).toHaveBeenLastCalledWith('SUBSCRIBER_UNAVAILABLE');
    });
  });

  describe('redisUrlFromConfig', () => {
    test('it builds a valid Redis URL from defaults', () => {
      expect(
        server.buildRedisOpts({
          port: 6379,
          host: '127.0.0.1',
          username: 'test-user',
          password: '',
          db: 0,
          ssl: false,
          validateHostname: false,
        }),
      ).toEqual({ db: 0, host: '127.0.0.1', port: 6379 });
    });
    test('it builds a valid Redis URL with a password', () => {
      expect(
        server.buildRedisOpts({
          port: 6380,
          host: 'redis.local',
          username: 'cool-user',
          password: 'foo',
          db: 1,
          ssl: false,
          validateHostname: false,
        }),
      ).toEqual({
        db: 1,
        host: 'redis.local',
        password: 'foo',
        port: 6380,
        username: 'cool-user',
      });
    });
    test('it builds a valid Redis URL with SSL', () => {
      expect(
        server.buildRedisOpts({
          port: 6379,
          host: '127.0.0.1',
          password: '',
          username: 'cool-user',
          db: 0,
          ssl: true,
          validateHostname: false,
        }),
      ).toEqual({
        db: 0,
        host: '127.0.0.1',
        port: 6379,
        tls: { checkServerIdentity: expect.anything() },
      });
    });
  });

  describe('subscribeToChannels', () => {
    const messageHandlers = () =>
      mockOn.mock.calls.filter(([event]) => event === 'message');

    beforeEach(() => {
      mockSubscribe.mockReset();
      mockOn.mockClear();
    });

    test('subscribes to the single realtime channel', async () => {
      mockSubscribe.mockResolvedValue(1);

      await server.subscribeToChannels();

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith('realtime');
      expect(messageHandlers()).toHaveLength(1);
    });

    test('subscribes to the prefixed channel when REALTIME_CHANNEL_PREFIX is set', async () => {
      mockSubscribe.mockResolvedValue(1);
      process.env.REALTIME_CHANNEL_PREFIX = 'tenant-a:';
      vi.resetModules();
      try {
        // Re-import so the module re-reads config: REALTIME_CHANNEL is derived
        // from opts at load time, so the prefix must flow env -> config -> the
        // subscribed channel name.
        const freshServer = await import('../src/index');
        await freshServer.subscribeToChannels();

        expect(mockSubscribe).toHaveBeenCalledWith('tenant-a:realtime');
      } finally {
        delete process.env.REALTIME_CHANNEL_PREFIX;
        vi.resetModules();
      }
    });

    test('retries a rejected subscription without stacking a second router', async () => {
      vi.useFakeTimers();
      try {
        mockSubscribe
          .mockRejectedValueOnce(new Error('redis unreachable'))
          .mockResolvedValueOnce(1);

        await server.subscribeToChannels();
        expect(mockSubscribe).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(5000);

        expect(mockSubscribe).toHaveBeenCalledTimes(2);
        // A retry must leave exactly one `message` listener: a second one
        // would route every message twice.
        expect(messageHandlers()).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    test('the registered message handler routes to the matching socket', async () => {
      mockSubscribe.mockResolvedValue(1);
      await server.subscribeToChannels();

      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      const [, handler] = messageHandlers()[0] as [
        string,
        (channel: string, message: string) => void,
      ];
      handler(
        'realtime',
        JSON.stringify({
          topic: 'entity.changed',
          scope: 'authenticated_global',
          payload: { entity_type: 'task', id: 'abc' },
        }),
      );

      expect(send).toHaveBeenCalledWith(
        JSON.stringify({
          topic: 'entity.changed',
          payload: { entity_type: 'task', id: 'abc' },
        }),
      );
    });
  });

  describe('principalChannel', () => {
    test('derives the routing key for each principal type', () => {
      expect(server.principalChannel('user', '5')).toEqual('user:5');
      expect(server.principalChannel('guest', 'guest:abc')).toEqual(
        'guest:abc',
      );
    });

    test('rejects an identity that names no routable channel', () => {
      // A guest key is namespaced by the backend; an unprefixed subject could
      // otherwise collide with another principal's channel.
      expect(server.principalChannel('guest', 'abc')).toBeNull();
      expect(server.principalChannel('user', '')).toBeNull();
      expect(server.principalChannel('guest', '')).toBeNull();
    });
  });

  describe('readSocketIdentity', () => {
    test('extracts the identity a valid token proves', () => {
      const token = signRealtimeToken();

      expect(server.readSocketIdentity(makeRequest({ token }))).toEqual({
        channel: channelId,
        principalType: 'user',
        subject: '5',
        tokenExpiresAtMs: expect.any(Number),
      });
    });

    test('accepts a token signed with the previous secret', () => {
      const token = signRealtimeToken({}, config.previousJwtSecret);

      expect(server.readSocketIdentity(makeRequest({ token })).channel).toEqual(
        channelId,
      );
    });

    test('rejects a request with no JWT cookie', () => {
      expect(() => server.readSocketIdentity(makeRequest())).toThrow(
        'JWT not present',
      );
    });

    test.each([
      ['a token signed with an unknown secret', {}, 'invalid secret'],
      ['an expired token', { exp: Math.floor(Date.now() / 1000) - 1 }],
      ['a token for another audience', { aud: 'someone-else' }],
      ['a token from another issuer', { iss: 'not-superset' }],
      ['a token with no channel claim', { channel: undefined }],
      ['a token with no subject', { sub: undefined }],
      ['a token with no expiration', { exp: undefined }],
      ['a token with no principal type', { principal_type: undefined }],
      ['a token with an unknown principal type', { principal_type: 'robot' }],
      [
        'a user whose channel does not match its subject',
        { channel: 'user:6' },
      ],
      [
        'a guest whose channel does not match its subject',
        { channel: 'guest:abc', sub: 'guest:def', principal_type: 'guest' },
      ],
      [
        'a guest subject that is not namespaced',
        { channel: 'abc', sub: 'abc', principal_type: 'guest' },
      ],
    ])(
      'rejects %s',
      (
        _description: string,
        overrides: Record<string, unknown>,
        secret: string = config.jwtSecret,
      ) => {
        const token = signRealtimeToken(overrides, secret);

        expect(() =>
          server.readSocketIdentity(makeRequest({ token })),
        ).toThrow();
      },
    );
  });

  describe('routeRedisMessage', () => {
    const taskStatus = (routes: string[], scope = 'tab') =>
      JSON.stringify({
        topic: 'task.status',
        scope,
        routes,
        payload: { task_id: 'abc', status: 'success' },
      });

    test('fans a task-status message out to the named routes only', () => {
      // Two principals connected; a task-status message targeting user:5 reaches
      // only user:5 and is forwarded as a per-principal browser message.
      const wsA = new wsMock('localhost');
      const sendA = vi.spyOn(wsA, 'send');
      trackSocket('user:5', wsA);

      const wsB = new wsMock('localhost');
      const sendB = vi.spyOn(wsB, 'send');
      trackSocket('user:9', wsB);

      server.routeRedisMessage('realtime', taskStatus(['user:5'], 'principal'));

      expect(sendA).toHaveBeenCalledTimes(1);
      expect(sendA).toHaveBeenCalledWith(
        JSON.stringify({
          topic: 'task.status',
          payload: { task_id: 'abc', status: 'success' },
        }),
      );
      expect(sendB).not.toHaveBeenCalled();
    });

    test('fans a task-status message out to a guest channel', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket('guest:abc', ws);

      server.routeRedisMessage(
        'realtime',
        JSON.stringify({
          topic: 'task.status',
          scope: 'principal',
          routes: ['guest:abc'],
          payload: { task_id: 'xyz', status: 'failure' },
        }),
      );

      expect(send).toHaveBeenCalledWith(
        JSON.stringify({
          topic: 'task.status',
          payload: { task_id: 'xyz', status: 'failure' },
        }),
      );
    });

    test('fans a per-tab task-status message out to only that tab', () => {
      // Two tabs of one principal, each dual-registered on user:5 and its own
      // per-tab channel. A message targeting user:5:tabA reaches only tab A.
      const wsA = new wsMock('localhost');
      const sendA = vi.spyOn(wsA, 'send');
      server.wsConnection(wsA, makeIdentity('user:5'), 'tabA');

      const wsB = new wsMock('localhost');
      const sendB = vi.spyOn(wsB, 'send');
      server.wsConnection(wsB, makeIdentity('user:5'), 'tabB');

      server.routeRedisMessage('realtime', taskStatus(['user:5:tabA']));

      expect(sendA).toHaveBeenCalledTimes(1);
      expect(sendA).toHaveBeenCalledWith(
        JSON.stringify({
          topic: 'task.status',
          payload: { task_id: 'abc', status: 'success' },
        }),
      );
      expect(sendB).not.toHaveBeenCalled();
    });

    test('drops an envelope with an empty-string routing key', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket('user:5', ws);

      server.routeRedisMessage('realtime', taskStatus(['']));

      expect(send).not.toHaveBeenCalled();
    });

    test('deduplicates repeated routing keys within a targeted message', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket('user:5', ws);

      server.routeRedisMessage('realtime', taskStatus(['user:5', 'user:5']));

      expect(send).toHaveBeenCalledTimes(1);
    });

    test('broadcasts an entity-change nudge to every socket', () => {
      const wsA = new wsMock('localhost');
      const sendA = vi.spyOn(wsA, 'send');
      trackSocket('user:5', wsA);

      const wsB = new wsMock('localhost');
      const sendB = vi.spyOn(wsB, 'send');
      trackSocket('guest:abc', wsB);

      const payload = { entity_type: 'task', id: 'abc' };
      server.routeRedisMessage(
        'realtime',
        JSON.stringify({
          topic: 'entity.changed',
          scope: 'authenticated_global',
          payload,
        }),
      );

      const expected = JSON.stringify({ topic: 'entity.changed', payload });
      expect(sendA).toHaveBeenCalledWith(expected);
      expect(sendB).toHaveBeenCalledWith(expected);
    });

    test('broadcasts once to a dual-registered (per-tab) socket', () => {
      // A socket registered under both its principal and per-tab channel must
      // receive a broadcast exactly once (dedup by socket, not by channel).
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.wsConnection(ws, makeIdentity('user:5'), 'tabA');

      server.routeRedisMessage(
        'realtime',
        JSON.stringify({
          topic: 'entity.changed',
          scope: 'authenticated_global',
          payload: { entity_type: 'task', id: 'abc' },
        }),
      );

      expect(send).toHaveBeenCalledTimes(1);
    });

    test('swallows a malformed (non-JSON) message', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      // Must not throw; simply drops the unparseable message.
      expect(() =>
        server.routeRedisMessage('realtime', 'not json'),
      ).not.toThrow();
      expect(send).not.toHaveBeenCalled();
    });

    test('drops a malformed envelope (missing topic)', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      server.routeRedisMessage(
        'realtime',
        JSON.stringify({ scope: 'authenticated_global', payload: { id: 1 } }),
      );

      expect(send).not.toHaveBeenCalled();
    });

    test('a targeted envelope with no routes delivers nowhere', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      trackSocket('user:5', ws);

      server.routeRedisMessage(
        'realtime',
        JSON.stringify({
          topic: 'task.status',
          scope: 'principal',
          payload: { task_id: 'abc', status: 'success' },
        }),
      );

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('backpressure', () => {
    const message: server.OutboundMessage = {
      topic: 'task.status',
      payload: { task_id: 'abc', status: 'success' },
    };

    afterEach(() => {
      server.opts.maxSocketBufferBytes = 0;
      // Restore any spies (e.g. on server.cleanChannel) so they don't leak
      // across tests and cause order-dependent failures.
      vi.restoreAllMocks();
    });

    test('does not terminate when cap disabled (0)', () => {
      server.opts.maxSocketBufferBytes = 0;
      const ws = new wsMock('localhost');
      // simulate a large outbound buffer
      vi.spyOn(ws, 'bufferedAmount', 'get').mockReturnValueOnce(10_000_000);
      const terminateMock = vi.spyOn(ws, 'terminate');
      const sendMock = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      server.sendToChannel(channelId, message);

      expect(terminateMock).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalled();
    });

    test('terminates a slow client whose buffer exceeds the cap', () => {
      server.opts.maxSocketBufferBytes = 1024;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'bufferedAmount', 'get').mockReturnValueOnce(2048);
      const terminateMock = vi.spyOn(ws, 'terminate');
      const sendMock = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      server.sendToChannel(channelId, message);

      expect(terminateMock).toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
      expect(statsdIncrementMock).toHaveBeenCalledWith(
        'ws_client_backpressure_disconnect',
      );
      expect(Object.keys(server.channels)).toHaveLength(0);
    });

    test('keeps sending to a client within the cap', () => {
      server.opts.maxSocketBufferBytes = 1024;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'bufferedAmount', 'get').mockReturnValueOnce(16);
      const terminateMock = vi.spyOn(ws, 'terminate');
      const sendMock = vi.spyOn(ws, 'send');
      trackSocket(channelId, ws);

      server.sendToChannel(channelId, message);

      expect(terminateMock).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalled();
    });

    test('error sending data to client cleans the channel', () => {
      const ws = new wsMock('localhost');
      const sendMock = vi.spyOn(ws, 'send').mockImplementation(() => {
        throw new Error();
      });
      trackSocket(channelId, ws);

      server.sendToChannel(channelId, message);

      expect(sendMock).toHaveBeenCalled();
      expect(statsdIncrementMock).toHaveBeenCalledWith('ws_client_send_error');
      expect(Object.keys(server.channels)).toHaveLength(0);
    });
  });

  describe('wsConnection', () => {
    let ws: WebSocket;
    let wsEventMock: Mock<typeof ws.on>;
    let dateNowSpy: Mock<typeof Date.now>;
    let socketInstanceExpected: server.SocketInstance;

    beforeEach(() => {
      ws = new wsMock('localhost');
      wsEventMock = vi.spyOn(ws, 'on');
      dateNowSpy = vi
        .spyOn(global.Date, 'now')
        .mockImplementation(() =>
          new Date('2021-03-10T11:01:58.135Z').valueOf(),
        );
      socketInstanceExpected = {
        ws,
        channel: channelId,
        identity: {
          channel: channelId,
          principalType: 'user',
          subject: '5',
          tokenExpiresAtMs: 1615377718000,
        },
        pongTs: 1615374118135,
      };
    });

    afterEach(() => {
      wsEventMock?.mockRestore();
      dateNowSpy?.mockRestore();
    });

    test('valid JWT binds the socket to its channel', async () => {
      connect(ws, signRealtimeToken());

      const channelSockets = server.channels[channelId];
      expect(channelSockets).toEqual({
        sockets: expect.any(Array<string>),
      });
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId]).toEqual(socketInstanceExpected);
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    test('valid guest JWT binds the socket to its guest channel', async () => {
      const guestChannelId = 'guest:abc';
      connect(
        ws,
        signRealtimeToken({
          channel: guestChannelId,
          sub: guestChannelId,
          principal_type: 'guest',
        }),
      );

      const channelSockets = server.channels[guestChannelId];
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId].identity).toMatchObject({
        channel: guestChannelId,
        principalType: 'guest',
        subject: guestChannelId,
      });
    });

    test('a tab_id also binds the socket to its per-tab channel', async () => {
      server.wsConnection(ws, makeIdentity(channelId), 'tabA');

      // One socket id, indexed under both the principal and the per-tab channel.
      const principalSockets = server.channels[channelId].sockets;
      const tabSockets = server.channels[`${channelId}:tabA`].sockets;
      expect(principalSockets).toHaveLength(1);
      expect(tabSockets).toEqual(principalSockets);
      const socketId = principalSockets[0];
      expect(Object.keys(server.sockets)).toEqual([socketId]);
      expect(server.sockets[socketId].tabChannel).toEqual(`${channelId}:tabA`);
    });

    test('unsolicited pong payload cannot pollute Object.prototype', async () => {
      connect(ws, signRealtimeToken());

      // Extract the handler registered for the 'pong' event, the same way
      // the underlying `ws` library would invoke it on a raw pong frame.
      const pongCall = wsEventMock.mock.calls.find(call => call[0] === 'pong');
      expect(pongCall).toBeDefined();
      const pongHandler = pongCall![1] as (data: Buffer) => void;

      // An unsolicited pong with a payload matching an inherited key must not
      // resolve through the prototype chain and must not write through to
      // Object.prototype.
      pongHandler(Buffer.from('__proto__'));
      pongHandler(Buffer.from('constructor'));
      pongHandler(Buffer.from('hasOwnProperty'));

      // oxlint-disable-next-line no-prototype-builtins
      expect(Object.prototype.hasOwnProperty('pongTs')).toBe(false);
      expect(({} as Record<string, unknown>).pongTs).toBeUndefined();

      // A genuine socket id must still record its pong normally.
      const socketId = server.channels[channelId].sockets[0];
      const beforePongTs = server.sockets[socketId].pongTs;
      dateNowSpy.mockImplementation(() =>
        new Date('2021-03-10T11:02:58.135Z').valueOf(),
      );
      pongHandler(Buffer.from(socketId));
      expect(server.sockets[socketId].pongTs).not.toBe(beforePongTs);
      expect(server.sockets[socketId].pongTs).toBe(
        new Date('2021-03-10T11:02:58.135Z').valueOf(),
      );
    });
  });

  describe('connection limits', () => {
    afterEach(() => {
      // restore opt-in limits to their disabled default
      server.opts.maxTotalConnections = 0;
      server.opts.maxConnectionsPerChannel = 0;
    });

    test('no limit when disabled (0)', () => {
      server.opts.maxTotalConnections = 0;
      server.opts.maxConnectionsPerChannel = 0;
      trackSocket(channelId, new wsMock('localhost'));
      expect(server.connectionLimitReason(channelId)).toBeNull();
    });

    test('total connection limit reached', () => {
      server.opts.maxTotalConnections = 1;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws);
      expect(server.connectionLimitReason('some-other-channel')).toMatch(
        /total connection limit/,
      );
    });

    test('per-channel connection limit reached', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws);
      expect(server.connectionLimitReason(channelId)).toMatch(
        /per-channel connection limit/,
      );
    });

    test('stale closed socket does not count toward total limit', () => {
      server.opts.maxTotalConnections = 1;
      const ws = new wsMock('localhost');
      trackSocket(channelId, ws);
      // simulate the socket having closed but not yet been GC'd
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      expect(server.connectionLimitReason('some-other-channel')).toBeNull();
    });

    test('stale closed socket does not count toward per-channel limit', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const ws = new wsMock('localhost');
      trackSocket(channelId, ws);
      // simulate the socket having closed but not yet been GC'd
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      expect(server.connectionLimitReason(channelId)).toBeNull();
    });

    test('isSocketActive reflects the socket readyState', () => {
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      const socketId = trackSocket(channelId, ws);
      expect(server.isSocketActive(socketId)).toBe(true);
      // CONNECTING is also considered active (see SOCKET_ACTIVE_STATES)
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CONNECTING);
      expect(server.isSocketActive(socketId)).toBe(true);
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      expect(server.isSocketActive(socketId)).toBe(false);
      // unknown socket ids are never active
      expect(server.isSocketActive('does-not-exist')).toBe(false);
    });

    test('activeSocketCount counts only active sockets', () => {
      const openWs = new wsMock('localhost');
      vi.spyOn(openWs, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, openWs);
      const closedWs = new wsMock('localhost');
      vi.spyOn(closedWs, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      trackSocket(channelId, closedWs);
      expect(server.activeSocketCount()).toBe(1);
    });

    test('activeChannelSocketCount counts only active sockets on the channel', () => {
      const openWs = new wsMock('localhost');
      vi.spyOn(openWs, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, openWs);
      const closedWs = new wsMock('localhost');
      vi.spyOn(closedWs, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      trackSocket(channelId, closedWs);
      expect(server.activeChannelSocketCount(channelId)).toBe(1);
      // unknown channels report zero active sockets
      expect(server.activeChannelSocketCount('no-such-channel')).toBe(0);
    });

    test('wsConnection refuses over-limit connection without tracking', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const existingWs = new wsMock('localhost');
      vi.spyOn(existingWs, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, existingWs);

      const trackClientSpy = vi.spyOn(server, 'trackClient');
      const ws = new wsMock('localhost');
      connect(ws, signRealtimeToken());

      expect(ws.close).toHaveBeenCalledWith(
        1013,
        expect.stringMatching(/limit/),
      );
      expect(trackClientSpy).not.toHaveBeenCalled();
      trackClientSpy.mockRestore();
    });
  });

  describe('httpUpgrade', () => {
    let socket: net.Socket;
    let socketDestroySpy: Mock<typeof socket.destroy>;
    let wssUpgradeSpy: Mock<typeof server.wss.handleUpgrade>;

    beforeEach(() => {
      socket = new net.Socket();
      socketDestroySpy = vi.spyOn(socket, 'destroy');
      wssUpgradeSpy = vi.spyOn(server.wss, 'handleUpgrade');
    });

    afterEach(() => {
      wssUpgradeSpy.mockRestore();
    });

    test('invalid JWT', async () => {
      const token = signRealtimeToken({}, 'invalid secret');

      server.httpUpgrade(makeRequest({ token }), socket, Buffer.alloc(5));

      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
      // rejected upgrades are counted for auditability
      expect(statsdIncrementMock).toHaveBeenCalledWith('ws_upgrade_rejected');
    });

    test('valid JWT, no channel', async () => {
      const token = signRealtimeToken({ channel: undefined });

      server.httpUpgrade(makeRequest({ token }), socket, Buffer.alloc(5));

      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
    });

    test('valid upgrade', async () => {
      const token = signRealtimeToken();

      server.httpUpgrade(makeRequest({ token }), socket, Buffer.alloc(5));

      expect(socketDestroySpy).not.toHaveBeenCalled();
      expect(wssUpgradeSpy).toHaveBeenCalled();
    });

    test('valid upgrade with previous JWT secret', async () => {
      const token = signRealtimeToken({}, config.previousJwtSecret);

      server.httpUpgrade(makeRequest({ token }), socket, Buffer.alloc(5));

      expect(socketDestroySpy).not.toHaveBeenCalled();
      expect(wssUpgradeSpy).toHaveBeenCalled();
    });

    test('an accepted upgrade tracks the socket without re-verifying the JWT', async () => {
      const token = signRealtimeToken();
      const ws = new wsMock('localhost');
      // Hand the upgrade callback a socket, as the real handshake would, but
      // strip the cookie from the request first: the identity must already have
      // been carried over from the single upgrade-time verification.
      const request = makeRequest({ token });
      wssUpgradeSpy.mockImplementation(
        (_request, _socket, _head, callback: (ws: WebSocket) => void) => {
          request.headers.cookie = '';
          callback(ws);
        },
      );

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(server.channels[channelId].sockets).toHaveLength(1);
    });

    test('an accepted upgrade binds the per-tab channel from ?tab_id', async () => {
      const token = signRealtimeToken();
      const ws = new wsMock('localhost');
      const request = makeRequest({
        token,
        url: 'http://localhost/?tab_id=tabA',
      });
      wssUpgradeSpy.mockImplementation(
        (_request, _socket, _head, callback: (ws: WebSocket) => void) => {
          callback(ws);
        },
      );

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(server.channels[channelId].sockets).toHaveLength(1);
      expect(server.channels[`${channelId}:tabA`].sockets).toEqual(
        server.channels[channelId].sockets,
      );
    });

    test('an accepted upgrade ignores an invalid ?tab_id', async () => {
      // A tab id outside the allowed length/charset must not become a channel
      // key; the socket falls back to principal-grain (no per-tab channel).
      const token = signRealtimeToken();
      const ws = new wsMock('localhost');
      const badTabId = 'a'.repeat(65);
      const request = makeRequest({
        token,
        url: `http://localhost/?tab_id=${badTabId}`,
      });
      wssUpgradeSpy.mockImplementation(
        (_request, _socket, _head, callback: (ws: WebSocket) => void) => {
          callback(ws);
        },
      );

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(server.channels[channelId].sockets).toHaveLength(1);
      expect(server.channels[`${channelId}:${badTabId}`]).toBeUndefined();
    });

    describe('origin validation', () => {
      afterEach(() => {
        server.opts.allowedOrigins = [];
      });

      test('rejects upgrade from a disallowed origin', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const token = signRealtimeToken();

        server.httpUpgrade(
          makeRequest({ token, origin: 'https://evil.example' }),
          socket,
          Buffer.alloc(5),
        );

        expect(socketDestroySpy).toHaveBeenCalled();
        expect(wssUpgradeSpy).not.toHaveBeenCalled();
      });

      test('rejects upgrade with no origin when an allowlist is set', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const token = signRealtimeToken();

        server.httpUpgrade(makeRequest({ token }), socket, Buffer.alloc(5));

        expect(socketDestroySpy).toHaveBeenCalled();
        expect(wssUpgradeSpy).not.toHaveBeenCalled();
      });

      test('allows upgrade from an allowed origin', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const token = signRealtimeToken();

        server.httpUpgrade(
          makeRequest({ token, origin: 'https://superset.example.com' }),
          socket,
          Buffer.alloc(5),
        );

        expect(socketDestroySpy).not.toHaveBeenCalled();
        expect(wssUpgradeSpy).toHaveBeenCalled();
      });
    });
  });

  describe('subscriber health', () => {
    test('markSubscriberUnhealthy closes open sockets with a retryable code', () => {
      // resetState() leaves the server healthy; open a socket, then drop the
      // subscriber and assert the socket is closed so the client reconnects.
      const ws = new wsMock('localhost');
      const closeSpy = vi.spyOn(ws, 'close');
      trackSocket(channelId, ws);

      server.markSubscriberUnhealthy('test drop');

      expect(server.subscriberHealthy).toBe(false);
      expect(closeSpy).toHaveBeenCalledWith(1012, expect.any(String));
    });

    test('markSubscriberUnhealthy is a no-op when already unhealthy (edge only)', () => {
      server.markSubscriberUnhealthy('first');
      const ws = new wsMock('localhost');
      const closeSpy = vi.spyOn(ws, 'close');
      trackSocket(channelId, ws);

      server.markSubscriberUnhealthy('second'); // already unhealthy

      expect(closeSpy).not.toHaveBeenCalled();
    });

    test('httpUpgrade is refused with 503 while the subscriber is unhealthy', () => {
      server.markSubscriberUnhealthy('test drop');
      const socket = new net.Socket();
      const destroySpy = vi.spyOn(socket, 'destroy');
      const writeSpy = vi.spyOn(socket, 'write');
      const upgradeSpy = vi.spyOn(server.wss, 'handleUpgrade');

      server.httpUpgrade(
        makeRequest({ token: signRealtimeToken() }),
        socket,
        Buffer.alloc(5),
      );

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('503'));
      expect(destroySpy).toHaveBeenCalled();
      expect(upgradeSpy).not.toHaveBeenCalled();
      expect(statsdIncrementMock).toHaveBeenCalledWith('ws_upgrade_rejected');
      upgradeSpy.mockRestore();
    });

    test('markSubscriberHealthy restores the transport so upgrades proceed', () => {
      server.markSubscriberUnhealthy('test drop');
      server.markSubscriberHealthy();

      const socket = new net.Socket();
      const destroySpy = vi.spyOn(socket, 'destroy');
      const upgradeSpy = vi.spyOn(server.wss, 'handleUpgrade');

      server.httpUpgrade(
        makeRequest({ token: signRealtimeToken() }),
        socket,
        Buffer.alloc(5),
      );

      expect(destroySpy).not.toHaveBeenCalled();
      expect(upgradeSpy).toHaveBeenCalled();
      upgradeSpy.mockRestore();
    });
  });

  describe('isOriginAllowed', () => {
    afterEach(() => {
      server.opts.allowedOrigins = [];
    });

    test('allows any origin when allowlist is empty', () => {
      server.opts.allowedOrigins = [];
      expect(
        server.isOriginAllowed(makeRequest({ origin: 'https://anything' })),
      ).toBe(true);
      expect(server.isOriginAllowed(makeRequest())).toBe(true);
    });

    test('allows any origin when allowlist contains a wildcard', () => {
      server.opts.allowedOrigins = ['*'];
      expect(
        server.isOriginAllowed(makeRequest({ origin: 'https://anything' })),
      ).toBe(true);
    });

    test('allows an exact-match origin', () => {
      server.opts.allowedOrigins = ['https://a.example', 'https://b.example'];
      expect(
        server.isOriginAllowed(makeRequest({ origin: 'https://b.example' })),
      ).toBe(true);
    });

    test('rejects a non-matching or missing origin', () => {
      server.opts.allowedOrigins = ['https://a.example'];
      expect(
        server.isOriginAllowed(makeRequest({ origin: 'https://evil.example' })),
      ).toBe(false);
      expect(server.isOriginAllowed(makeRequest())).toBe(false);
    });
  });

  describe('checkSockets', () => {
    let ws: WebSocket;
    let pingSpy: Mock<typeof ws.ping>;
    let terminateSpy: Mock<typeof ws.terminate>;

    beforeEach(() => {
      ws = new wsMock('localhost');
      pingSpy = vi.spyOn(ws, 'ping');
      terminateSpy = vi.spyOn(ws, 'terminate');
    });

    test('active sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws);

      server.checkSockets();

      expect(pingSpy).toHaveBeenCalled();
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(1);
    });

    test('sockets with expired JWTs are terminated', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws, {
        identity: makeIdentity(channelId, Date.now() - 1),
      });

      server.checkSockets();

      expect(pingSpy).not.toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(0);
      expect(statsdIncrementMock).toHaveBeenCalledWith(
        'ws_token_expired_disconnect',
      );
    });

    test('stale sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws, { pongTs: Date.now() - 60000 });

      server.checkSockets();

      expect(pingSpy).not.toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(0);
    });

    test('closed sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      trackSocket(channelId, ws);

      server.checkSockets();

      expect(pingSpy).not.toHaveBeenCalled();
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(0);
    });

    test('no sockets', () => {
      // don't error
      server.checkSockets();
    });
  });

  describe('cleanChannel', () => {
    let ws: WebSocket;

    beforeEach(() => {
      ws = new wsMock('localhost');
    });

    test('active sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws);

      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(1);
    });

    test('closing sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSING);
      trackSocket(channelId, ws);

      server.cleanChannel(channelId);

      expect(server.channels[channelId]).toBeUndefined();
    });

    test('multiple sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws);

      const ws2 = new wsMock('localhost');
      const readyStateSpy = vi.spyOn(ws2, 'readyState', 'get');
      readyStateSpy.mockReturnValue(WebSocket.OPEN);
      trackSocket(channelId, ws2);

      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(2);

      readyStateSpy.mockReturnValue(WebSocket.CLOSED);
      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(1);
    });

    test('invalid channel', () => {
      // don't error
      server.cleanChannel(channelId);
    });
  });
});
