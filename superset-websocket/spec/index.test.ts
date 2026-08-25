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
const jwt = require('jsonwebtoken');
const config = require('../config.test.json');

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

const { mockPsubscribe, mockOn } = vi.hoisted(() => {
  return { mockPsubscribe: vi.fn(), mockOn: vi.fn() };
});

vi.mock('ws');
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(function () {
      return { psubscribe: mockPsubscribe, on: mockOn };
    }),
  };
});

const wsMock = WebSocket as unknown as Mock<typeof WebSocket>;
const channelId = 'user:5';

const realtimeClaims = (overrides: Record<string, unknown> = {}) => ({
  channel: channelId,
  sub: '5',
  principal_type: 'user',
  permissions: ['can_read:Realtime'],
  aud: 'superset-websocket',
  iss: 'superset',
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

const signRealtimeToken = (
  overrides: Record<string, unknown> = {},
  secret = config.jwtSecret,
) => jwt.sign(realtimeClaims(overrides), secret);

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

  describe('routeRedisMessage', () => {
    test('fans a task-status message out to subscriber principals only', () => {
      // Two principals connected; a task-status message targeting user:5 reaches
      // only user:5 and is forwarded as a per-principal browser message.
      const wsA = new wsMock('localhost');
      const sendA = vi.spyOn(wsA, 'send');
      server.trackClient('user:5', {
        ws: wsA,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      const wsB = new wsMock('localhost');
      const sendB = vi.spyOn(wsB, 'send');
      server.trackClient('user:9', {
        ws: wsB,
        channel: 'user:9',
        pongTs: Date.now(),
      });

      const payload = {
        task_id: 'abc',
        status: 'success',
        subscribers: [{ principal_type: 'user', sub: '5' }],
      };
      server.routeRedisMessage('task-status', JSON.stringify(payload));

      expect(sendA).toHaveBeenCalledTimes(1);
      expect(sendA).toHaveBeenCalledWith(
        JSON.stringify({
          channel: 'realtime:user:5',
          payload: { task_id: 'abc', status: 'success' },
        }),
      );
      expect(sendB).not.toHaveBeenCalled();
    });

    test('fans a task-status message out to a guest subscriber principal', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.trackClient('guest:abc', {
        ws,
        channel: 'guest:abc',
        pongTs: Date.now(),
      });

      const payload = {
        task_id: 'xyz',
        status: 'failure',
        subscribers: [{ principal_type: 'guest', sub: 'guest:abc' }],
      };
      server.routeRedisMessage('task-status', JSON.stringify(payload));

      expect(send).toHaveBeenCalledWith(
        JSON.stringify({
          channel: 'realtime:guest:abc',
          payload: { task_id: 'xyz', status: 'failure' },
        }),
      );
    });

    test('deduplicates subscriber principals within a task-status message', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.trackClient('user:5', {
        ws,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      server.routeRedisMessage(
        'task-status',
        JSON.stringify({
          task_id: 'abc',
          status: 'success',
          subscribers: [
            { principal_type: 'user', sub: '5' },
            { principal_type: 'user', sub: '5' },
          ],
        }),
      );

      expect(send).toHaveBeenCalledTimes(1);
    });

    test('broadcasts an entity-change nudge to every socket', () => {
      const wsA = new wsMock('localhost');
      const sendA = vi.spyOn(wsA, 'send');
      server.trackClient('user:5', {
        ws: wsA,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      const wsB = new wsMock('localhost');
      const sendB = vi.spyOn(wsB, 'send');
      server.trackClient('guest:abc', {
        ws: wsB,
        channel: 'guest:abc',
        pongTs: Date.now(),
      });

      const payload = { entity_type: 'task', id: 'abc' };
      server.routeRedisMessage('entity-changes:task', JSON.stringify(payload));

      const expected = JSON.stringify({
        channel: 'entity-changes:task',
        payload,
      });
      expect(sendA).toHaveBeenCalledWith(expected);
      expect(sendB).toHaveBeenCalledWith(expected);
    });

    test('ignores a message on an unrecognized channel', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.trackClient('user:5', {
        ws,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      server.routeRedisMessage('some-other:channel', JSON.stringify({ a: 1 }));

      expect(send).not.toHaveBeenCalled();
    });

    test('swallows a malformed (non-JSON) message', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.trackClient('user:5', {
        ws,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      // Must not throw; simply drops the unparseable message.
      expect(() =>
        server.routeRedisMessage('task-status', 'not json'),
      ).not.toThrow();
      expect(send).not.toHaveBeenCalled();
    });

    test('drops a malformed task-status message', () => {
      const ws = new wsMock('localhost');
      const send = vi.spyOn(ws, 'send');
      server.trackClient('user:5', {
        ws,
        channel: 'user:5',
        pongTs: Date.now(),
      });

      server.routeRedisMessage(
        'task-status',
        JSON.stringify({ task_id: 'abc', status: 'success' }),
      );

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('backpressure', () => {
    const message: server.OutboundMessage = {
      channel: 'realtime:user:5',
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
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });

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
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });

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
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });

      server.sendToChannel(channelId, message);

      expect(terminateMock).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalled();
    });

    test('error sending data to client cleans the channel', () => {
      const ws = new wsMock('localhost');
      const sendMock = vi.spyOn(ws, 'send').mockImplementation(() => {
        throw new Error();
      });
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });

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

    const getRequest = (token: string, url: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      request.method = 'GET';
      request.headers = { cookie: `${config.jwtCookieName}=${token}` };
      request.url = url;
      return request;
    };

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
          username: undefined,
        },
        pongTs: 1615374118135,
      };
    });

    afterEach(() => {
      wsEventMock?.mockRestore();
      dateNowSpy?.mockRestore();
    });

    test('invalid JWT', async () => {
      const invalidToken = signRealtimeToken({}, 'invalid secret');
      const request = getRequest(invalidToken, 'http://localhost');

      expect(() => {
        server.wsConnection(ws, request);
      }).toThrow();
    });

    test('valid JWT binds the socket to its channel', async () => {
      const validToken = signRealtimeToken();
      const request = getRequest(validToken, 'http://localhost');

      server.wsConnection(ws, request);

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
      const validToken = signRealtimeToken({
        channel: guestChannelId,
        sub: guestChannelId,
        principal_type: 'guest',
      });
      const request = getRequest(validToken, 'http://localhost');

      server.wsConnection(ws, request);

      const channelSockets = server.channels[guestChannelId];
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId].identity).toMatchObject({
        channel: guestChannelId,
        principalType: 'guest',
        subject: guestChannelId,
      });
    });

    test('JWT without realtime permission is rejected', async () => {
      const token = signRealtimeToken({ permissions: [] });
      const request = getRequest(token, 'http://localhost');

      expect(() => {
        server.wsConnection(ws, request);
      }).toThrow();
    });

    test('JWT with mismatched channel and subject is rejected', async () => {
      const token = signRealtimeToken({ channel: 'user:6' });
      const request = getRequest(token, 'http://localhost');

      expect(() => {
        server.wsConnection(ws, request);
      }).toThrow();
    });

    test('unsolicited pong payload cannot pollute Object.prototype', async () => {
      const validToken = signRealtimeToken();
      const request = getRequest(validToken, 'http://localhost');

      server.wsConnection(ws, request);

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

      // eslint-disable-next-line no-prototype-builtins
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
    const getRequest = (token: string, url: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      request.method = 'GET';
      request.headers = { cookie: `${config.jwtCookieName}=${token}` };
      request.url = url;
      return request;
    };

    afterEach(() => {
      // restore opt-in limits to their disabled default
      server.opts.maxTotalConnections = 0;
      server.opts.maxConnectionsPerChannel = 0;
    });

    test('no limit when disabled (0)', () => {
      server.opts.maxTotalConnections = 0;
      server.opts.maxConnectionsPerChannel = 0;
      const socketInstance = {
        ws: new wsMock('localhost'),
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance);
      expect(server.connectionLimitReason(channelId)).toBeNull();
    });

    test('total connection limit reached', () => {
      server.opts.maxTotalConnections = 1;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      const socketInstance = {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance);
      expect(server.connectionLimitReason('some-other-channel')).toMatch(
        /total connection limit/,
      );
    });

    test('per-channel connection limit reached', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      const socketInstance = {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance);
      expect(server.connectionLimitReason(channelId)).toMatch(
        /per-channel connection limit/,
      );
    });

    test('stale closed socket does not count toward total limit', () => {
      server.opts.maxTotalConnections = 1;
      const ws = new wsMock('localhost');
      const socketInstance = {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance);
      // simulate the socket having closed but not yet been GC'd
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      expect(server.connectionLimitReason('some-other-channel')).toBeNull();
    });

    test('stale closed socket does not count toward per-channel limit', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const ws = new wsMock('localhost');
      const socketInstance = {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance);
      // simulate the socket having closed but not yet been GC'd
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      expect(server.connectionLimitReason(channelId)).toBeNull();
    });

    test('isSocketActive reflects the socket readyState', () => {
      const ws = new wsMock('localhost');
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      const socketId = server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });
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
      server.trackClient(channelId, {
        ws: openWs,
        channel: channelId,
        pongTs: Date.now(),
      });
      const closedWs = new wsMock('localhost');
      vi.spyOn(closedWs, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      server.trackClient(channelId, {
        ws: closedWs,
        channel: channelId,
        pongTs: Date.now(),
      });
      expect(server.activeSocketCount()).toBe(1);
    });

    test('activeChannelSocketCount counts only active sockets on the channel', () => {
      const openWs = new wsMock('localhost');
      vi.spyOn(openWs, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      server.trackClient(channelId, {
        ws: openWs,
        channel: channelId,
        pongTs: Date.now(),
      });
      const closedWs = new wsMock('localhost');
      vi.spyOn(closedWs, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      server.trackClient(channelId, {
        ws: closedWs,
        channel: channelId,
        pongTs: Date.now(),
      });
      expect(server.activeChannelSocketCount(channelId)).toBe(1);
      // unknown channels report zero active sockets
      expect(server.activeChannelSocketCount('no-such-channel')).toBe(0);
    });

    test('wsConnection refuses over-limit connection without tracking', () => {
      server.opts.maxConnectionsPerChannel = 1;
      const existingWs = new wsMock('localhost');
      vi.spyOn(existingWs, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      const existing = {
        ws: existingWs,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, existing);

      const trackClientSpy = vi.spyOn(server, 'trackClient');
      const ws = new wsMock('localhost');
      const validToken = signRealtimeToken();
      server.wsConnection(ws, getRequest(validToken, 'http://localhost'));

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

    const getRequest = (token: string, url: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      request.method = 'GET';
      request.headers = { cookie: `${config.jwtCookieName}=${token}` };
      request.url = url;
      return request;
    };

    beforeEach(() => {
      socket = new net.Socket();
      socketDestroySpy = vi.spyOn(socket, 'destroy');
      wssUpgradeSpy = vi.spyOn(server.wss, 'handleUpgrade');
    });

    afterEach(() => {
      wssUpgradeSpy.mockRestore();
    });

    test('invalid JWT', async () => {
      const invalidToken = signRealtimeToken({}, 'invalid secret');
      const request = getRequest(invalidToken, 'http://localhost');

      server.httpUpgrade(request, socket, Buffer.alloc(5));
      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
      // rejected upgrades are counted for auditability
      expect(statsdIncrementMock).toHaveBeenCalledWith('ws_upgrade_rejected');
    });

    test('valid JWT, no channel', async () => {
      const validToken = jwt.sign(
        realtimeClaims({ channel: undefined }),
        config.jwtSecret,
      );
      const request = getRequest(validToken, 'http://localhost');

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
    });

    test('valid upgrade', async () => {
      const validToken = signRealtimeToken();
      const request = getRequest(validToken, 'http://localhost');

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(socketDestroySpy).not.toHaveBeenCalled();
      expect(wssUpgradeSpy).toHaveBeenCalled();
    });

    describe('origin validation', () => {
      afterEach(() => {
        server.opts.allowedOrigins = [];
      });

      const getRequestWithOrigin = (
        token: string,
        origin?: string,
      ): http.IncomingMessage => {
        const request = new http.IncomingMessage(new net.Socket());
        request.method = 'GET';
        request.headers = { cookie: `${config.jwtCookieName}=${token}` };
        if (origin) request.headers.origin = origin;
        request.url = 'http://localhost';
        return request;
      };

      test('rejects upgrade from a disallowed origin', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const validToken = signRealtimeToken();
        const request = getRequestWithOrigin(
          validToken,
          'https://evil.example',
        );

        server.httpUpgrade(request, socket, Buffer.alloc(5));

        expect(socketDestroySpy).toHaveBeenCalled();
        expect(wssUpgradeSpy).not.toHaveBeenCalled();
      });

      test('rejects upgrade with no origin when an allowlist is set', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const validToken = signRealtimeToken();
        const request = getRequestWithOrigin(validToken);

        server.httpUpgrade(request, socket, Buffer.alloc(5));

        expect(socketDestroySpy).toHaveBeenCalled();
        expect(wssUpgradeSpy).not.toHaveBeenCalled();
      });

      test('allows upgrade from an allowed origin', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const validToken = signRealtimeToken();
        const request = getRequestWithOrigin(
          validToken,
          'https://superset.example.com',
        );

        server.httpUpgrade(request, socket, Buffer.alloc(5));

        expect(socketDestroySpy).not.toHaveBeenCalled();
        expect(wssUpgradeSpy).toHaveBeenCalled();
      });
    });
  });

  describe('isOriginAllowed', () => {
    const makeRequest = (origin?: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      if (origin) request.headers.origin = origin;
      return request;
    };

    afterEach(() => {
      server.opts.allowedOrigins = [];
    });

    test('allows any origin when allowlist is empty', () => {
      server.opts.allowedOrigins = [];
      expect(server.isOriginAllowed(makeRequest('https://anything'))).toBe(
        true,
      );
      expect(server.isOriginAllowed(makeRequest())).toBe(true);
    });

    test('allows any origin when allowlist contains a wildcard', () => {
      server.opts.allowedOrigins = ['*'];
      expect(server.isOriginAllowed(makeRequest('https://anything'))).toBe(
        true,
      );
    });

    test('allows an exact-match origin', () => {
      server.opts.allowedOrigins = ['https://a.example', 'https://b.example'];
      expect(server.isOriginAllowed(makeRequest('https://b.example'))).toBe(
        true,
      );
    });

    test('rejects a non-matching or missing origin', () => {
      server.opts.allowedOrigins = ['https://a.example'];
      expect(server.isOriginAllowed(makeRequest('https://evil.example'))).toBe(
        false,
      );
      expect(server.isOriginAllowed(makeRequest())).toBe(false);
    });
  });

  describe('checkSockets', () => {
    let ws: WebSocket;
    let pingSpy: Mock<typeof ws.ping>;
    let terminateSpy: Mock<typeof ws.terminate>;
    let socketInstance: server.SocketInstance;

    beforeEach(() => {
      ws = new wsMock('localhost');
      pingSpy = vi.spyOn(ws, 'ping');
      terminateSpy = vi.spyOn(ws, 'terminate');
      socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };
    });

    test('active sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      server.checkSockets();

      expect(pingSpy).toHaveBeenCalled();
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(1);
    });

    test('sockets with expired JWTs are terminated', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      socketInstance.identity = {
        channel: channelId,
        principalType: 'user',
        subject: '5',
        tokenExpiresAtMs: Date.now() - 1,
      };
      server.trackClient(channelId, socketInstance);

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
      socketInstance.pongTs = Date.now() - 60000;
      server.trackClient(channelId, socketInstance);

      server.checkSockets();

      expect(pingSpy).not.toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(0);
    });

    test('closed sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSED);
      server.trackClient(channelId, socketInstance);

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
    let socketInstance: server.SocketInstance;

    beforeEach(() => {
      ws = new wsMock('localhost');
      socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };
    });

    test('active sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(1);
    });

    test('closing sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.CLOSING);
      server.trackClient(channelId, socketInstance);

      server.cleanChannel(channelId);

      expect(server.channels[channelId]).toBeUndefined();
    });

    test('multiple sockets', () => {
      vi.spyOn(ws, 'readyState', 'get').mockReturnValue(WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      const ws2 = new wsMock('localhost');
      const readyStateSpy = vi.spyOn(ws2, 'readyState', 'get');
      readyStateSpy.mockReturnValue(WebSocket.OPEN);
      const socketInstance2 = {
        ws: ws2,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance2);

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
