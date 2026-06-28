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

const { mockRedisXrange } = vi.hoisted(() => {
  return { mockRedisXrange: vi.fn() };
});

vi.mock('ws');
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(function () {
      return { xrange: mockRedisXrange, on: vi.fn() };
    }),
  };
});

const wsMock = WebSocket as unknown as Mock<typeof WebSocket>;
const channelId = 'bc9e040c-7b4a-4817-99b9-292832d97ec7';
const streamReturnValue: server.StreamResult[] = [
  [
    '1615426152415-0',
    [
      'data',
      `{"channel_id": "${channelId}", "job_id": "c9b99965-8f1e-4ce5-aa43-d6fc94d6a510", "user_id": "1", "status": "done", "errors": [], "result_url": "/superset/explore_json/data/ejr-37281682b1282cdb8f25e0de0339b386"}`,
    ],
  ],
  [
    '1615426152516-0',
    [
      'data',
      `{"channel_id": "${channelId}", "job_id": "f1e5bb1f-f2f1-4f21-9b2f-c9b91dcc9b59", "user_id": "1", "status": "done", "errors": [], "result_url": "/api/v1/chart/data/qc-64e8452dc9907dd77746cb75a19202de"}`,
    ],
  ],
];

describe('server', () => {
  let statsdIncrementMock: Mock<typeof statsd.increment>;

  beforeEach(() => {
    mockRedisXrange.mockClear();
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

  describe('incrementId', () => {
    test('it increments a valid Redis stream ID', () => {
      expect(server.incrementId('1607477697866-0')).toEqual('1607477697866-1');
    });

    test('it handles an invalid Redis stream ID', () => {
      expect(server.incrementId('foo')).toEqual('foo');
    });
  });

  describe('getLastId', () => {
    const requestWithUrl = (url: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      request.url = url;
      return request;
    };

    test('returns null when last_id is absent', () => {
      expect(server.getLastId(requestWithUrl('http://localhost'))).toBeNull();
    });

    test('returns a well-formed Redis stream ID', () => {
      expect(
        server.getLastId(
          requestWithUrl('http://localhost?last_id=1607477697866-0'),
        ),
      ).toEqual('1607477697866-0');
    });

    test.each([
      'abc-xyz',
      '1607477697866',
      '1607477697866-',
      '-0',
      '1607477697866-0; DROP TABLE',
      '1607477697866-0-0',
    ])('returns null for malformed last_id %p', value => {
      expect(
        server.getLastId(
          requestWithUrl(
            `http://localhost?last_id=${encodeURIComponent(value)}`,
          ),
        ),
      ).toBeNull();
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

  describe('processStreamResults', () => {
    test('sends data to channel', async () => {
      const ws = new wsMock('localhost');
      const sendMock = vi.spyOn(ws, 'send');
      const socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };

      expect(statsdIncrementMock).toHaveBeenCalledTimes(0);
      server.trackClient(channelId, socketInstance);
      expect(statsdIncrementMock).toHaveBeenCalledTimes(1);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        1,
        'ws_connected_client',
      );

      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toHaveBeenCalledTimes(1);

      const message1 = `{"id":"1615426152415-0","channel_id":"${channelId}","job_id":"c9b99965-8f1e-4ce5-aa43-d6fc94d6a510","user_id":"1","status":"done","errors":[],"result_url":"/superset/explore_json/data/ejr-37281682b1282cdb8f25e0de0339b386"}`;
      const message2 = `{"id":"1615426152516-0","channel_id":"${channelId}","job_id":"f1e5bb1f-f2f1-4f21-9b2f-c9b91dcc9b59","user_id":"1","status":"done","errors":[],"result_url":"/api/v1/chart/data/qc-64e8452dc9907dd77746cb75a19202de"}`;
      expect(sendMock).toHaveBeenCalledWith(message1);
      expect(sendMock).toHaveBeenCalledWith(message2);
    });

    test('channel not present', async () => {
      const ws = new wsMock('localhost');
      const sendMock = vi.spyOn(ws, 'send');

      expect(statsdIncrementMock).toHaveBeenCalledTimes(0);
      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toHaveBeenCalledTimes(0);

      expect(sendMock).not.toHaveBeenCalled();
    });

    test('error sending data to client', async () => {
      const ws = new wsMock('localhost');
      const sendMock = vi.spyOn(ws, 'send').mockImplementation(() => {
        throw new Error();
      });
      const socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };

      expect(statsdIncrementMock).toHaveBeenCalledTimes(0);
      server.trackClient(channelId, socketInstance);
      expect(statsdIncrementMock).toHaveBeenCalledTimes(1);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        1,
        'ws_connected_client',
      );

      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toHaveBeenCalledTimes(2);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        2,
        'ws_client_send_error',
      );

      expect(sendMock).toHaveBeenCalled();
      expect(Object.keys(server.channels)).toHaveLength(0);
    });

    const makeItem = (i: number): server.StreamResult =>
      [
        `161542615${i}-0`,
        [
          'data',
          JSON.stringify({
            channel_id: channelId,
            job_id: `job-${i}`,
            status: 'done',
          }),
        ],
      ] as server.StreamResult;

    afterEach(() => {
      server.opts.eventYieldBatchSize = 100;
    });

    test('yields to the event loop for large batches', async () => {
      server.opts.eventYieldBatchSize = 2;
      const ws = new wsMock('localhost');
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });
      const sendMock = vi.spyOn(ws, 'send');
      const setImmediateSpy = vi.spyOn(global, 'setImmediate');

      const results = [0, 1, 2, 3, 4].map(makeItem);
      await server.processStreamResults(results);

      // every event is still delivered
      expect(sendMock).toHaveBeenCalledTimes(5);
      // and the loop yielded at least at indexes 2 and 4
      expect(setImmediateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      setImmediateSpy.mockRestore();
    });

    test('processes the whole batch when yielding is disabled', async () => {
      server.opts.eventYieldBatchSize = 0;
      const ws = new wsMock('localhost');
      server.trackClient(channelId, {
        ws,
        channel: channelId,
        pongTs: Date.now(),
      });
      const sendMock = vi.spyOn(ws, 'send');

      const results = [0, 1, 2, 3, 4].map(makeItem);
      await server.processStreamResults(results);

      expect(sendMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('backpressure', () => {
    const fakeEvent = {
      id: '1615426152415-0',
      channel_id: channelId,
      job_id: 'c9b99965-8f1e-4ce5-aa43-d6fc94d6a510',
      status: 'done',
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

      server.sendToChannel(channelId, fakeEvent);

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

      server.sendToChannel(channelId, fakeEvent);

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

      server.sendToChannel(channelId, fakeEvent);

      expect(terminateMock).not.toHaveBeenCalled();
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('fetchRangeFromStream', () => {
    beforeEach(() => {
      mockRedisXrange.mockClear();
    });

    test('success with results', async () => {
      mockRedisXrange.mockResolvedValueOnce(streamReturnValue);
      const cb = vi.fn() as Mock<
        (results: server.StreamResult[]) => void | Promise<void>
      >;
      await server.fetchRangeFromStream({
        sessionId: '123',
        startId: '-',
        endId: '+',
        listener: cb,
      });

      expect(mockRedisXrange).toHaveBeenCalledWith(
        'test-async-events-123',
        '-',
        '+',
      );
      expect(cb).toHaveBeenCalledWith(streamReturnValue);
    });

    test('success no results', async () => {
      const cb = vi.fn() as Mock<
        (results: server.StreamResult[]) => void | Promise<void>
      >;
      await server.fetchRangeFromStream({
        sessionId: '123',
        startId: '-',
        endId: '+',
        listener: cb,
      });

      expect(mockRedisXrange).toHaveBeenCalledWith(
        'test-async-events-123',
        '-',
        '+',
      );
      expect(cb).not.toHaveBeenCalled();
    });

    test('error', async () => {
      const cb = vi.fn() as Mock<
        (results: server.StreamResult[]) => void | Promise<void>
      >;
      mockRedisXrange.mockRejectedValueOnce(new Error());
      await server.fetchRangeFromStream({
        sessionId: '123',
        startId: '-',
        endId: '+',
        listener: cb,
      });

      expect(mockRedisXrange).toHaveBeenCalledWith(
        'test-async-events-123',
        '-',
        '+',
      );
      expect(cb).not.toHaveBeenCalled();
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
        pongTs: 1615374118135,
      };
    });

    afterEach(() => {
      wsEventMock?.mockRestore();
      dateNowSpy?.mockRestore();
    });

    test('invalid JWT', async () => {
      const invalidToken = jwt.sign({ channel: channelId }, 'invalid secret');
      const request = getRequest(invalidToken, 'http://localhost');

      expect(() => {
        server.wsConnection(ws, request);
      }).toThrow();
    });

    test('valid JWT, no lastId', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
      const request = getRequest(validToken, 'http://localhost');

      server.wsConnection(ws, request);

      const channelSockets = server.channels[channelId];
      expect(channelSockets).toEqual({
        sockets: expect.any(Array<string>),
      });
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId]).toEqual(socketInstanceExpected);
      expect(mockRedisXrange).not.toHaveBeenCalled();
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    test('valid JWT, malformed lastId is ignored', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
      const request = getRequest(
        validToken,
        'http://localhost?last_id=abc-xyz',
      );

      server.wsConnection(ws, request);

      const channelSockets = server.channels[channelId];
      expect(channelSockets).toEqual({
        sockets: expect.any(Array<string>),
      });
      expect(channelSockets.sockets).toHaveLength(1);

      // Malformed last_id must not trigger a stream range fetch.
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId]).toEqual(socketInstanceExpected);
    });

    test('valid JWT, with lastId', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
      const lastId = '1615426152415-0';
      const request = getRequest(
        validToken,
        `http://localhost?last_id=${lastId}`,
      );

      server.wsConnection(ws, request);

      const channelSockets = server.channels[channelId];
      expect(channelSockets).toEqual({
        sockets: expect.any(Array<string>),
      });
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId]).toEqual(socketInstanceExpected);
      expect(mockRedisXrange).toHaveBeenCalledWith(
        expect.stringContaining(channelId),
        '1615426152415-1',
        '+',
      );
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    test('valid JWT, with lastId and lastFirehoseId', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
      const lastId = '1615426152415-0';
      const lastFirehoseId = '1715426152415-0';
      const request = getRequest(
        validToken,
        `http://localhost?last_id=${lastId}`,
      );

      server.setLastFirehoseId(lastFirehoseId);
      server.wsConnection(ws, request);

      const channelSockets = server.channels[channelId];
      expect(channelSockets).toEqual({
        sockets: expect.any(Array<string>),
      });
      expect(channelSockets.sockets).toHaveLength(1);
      const socketId = channelSockets.sockets[0];
      expect(server.sockets[socketId]).toEqual(socketInstanceExpected);
      expect(mockRedisXrange).toHaveBeenCalledWith(
        expect.stringContaining(channelId),
        '1615426152415-1',
        lastFirehoseId,
      );
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
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
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
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
      const invalidToken = jwt.sign({ channel: channelId }, 'invalid secret');
      const request = getRequest(invalidToken, 'http://localhost');

      server.httpUpgrade(request, socket, Buffer.alloc(5));
      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
      // rejected upgrades are counted for auditability
      expect(statsdIncrementMock).toHaveBeenCalledWith('ws_upgrade_rejected');
    });

    test('valid JWT, no channel', async () => {
      const validToken = jwt.sign({ foo: 'bar' }, config.jwtSecret);
      const request = getRequest(validToken, 'http://localhost');

      server.httpUpgrade(request, socket, Buffer.alloc(5));

      expect(socketDestroySpy).toHaveBeenCalled();
      expect(wssUpgradeSpy).not.toHaveBeenCalled();
    });

    test('valid upgrade', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
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
        const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
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
        const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
        const request = getRequestWithOrigin(validToken);

        server.httpUpgrade(request, socket, Buffer.alloc(5));

        expect(socketDestroySpy).toHaveBeenCalled();
        expect(wssUpgradeSpy).not.toHaveBeenCalled();
      });

      test('allows upgrade from an allowed origin', () => {
        server.opts.allowedOrigins = ['https://superset.example.com'];
        const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
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
