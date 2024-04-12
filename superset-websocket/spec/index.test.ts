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

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import * as http from 'http';
import * as net from 'net';
import { WebSocket } from 'ws';

// NOTE: these mock variables needs to start with "mock" due to
// calls to `jest.mock` being hoisted to the top of the file.
// https://jestjs.io/docs/es6-class-mocks#calling-jestmock-with-the-module-factory-parameter
const mockRedisXrange = jest.fn();

jest.mock('ws');
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return { xrange: mockRedisXrange };
  });
});

const wsMock = WebSocket as jest.Mocked<typeof WebSocket>;
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

import * as server from '../src/index';
import { statsd } from '../src/index';

describe('server', () => {
  let statsdIncrementMock: jest.SpyInstance;

  beforeEach(() => {
    mockRedisXrange.mockClear();
    server.resetState();
    statsdIncrementMock = jest.spyOn(statsd, 'increment').mockReturnValue();
  });

  afterEach(() => {
    statsdIncrementMock.mockRestore();
  });

  describe('HTTP requests', () => {
    test('services health checks', () => {
      const endMock = jest.fn();
      const writeHeadMock = jest.fn();

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

      server.httpRequest(request as any, response as any);

      expect(writeHeadMock).toBeCalledTimes(1);
      expect(writeHeadMock).toHaveBeenLastCalledWith(200);

      expect(endMock).toBeCalledTimes(1);
      expect(endMock).toHaveBeenLastCalledWith('OK');
    });

    test('responds with a 404 when not found', () => {
      const endMock = jest.fn();
      const writeHeadMock = jest.fn();

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

      server.httpRequest(request as any, response as any);

      expect(writeHeadMock).toBeCalledTimes(1);
      expect(writeHeadMock).toHaveBeenLastCalledWith(404);

      expect(endMock).toBeCalledTimes(1);
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
      const sendMock = jest.spyOn(ws, 'send');
      const socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };

      expect(statsdIncrementMock).toBeCalledTimes(0);
      server.trackClient(channelId, socketInstance);
      expect(statsdIncrementMock).toBeCalledTimes(1);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        1,
        'ws_connected_client',
      );

      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toBeCalledTimes(1);

      const message1 = `{"id":"1615426152415-0","channel_id":"${channelId}","job_id":"c9b99965-8f1e-4ce5-aa43-d6fc94d6a510","user_id":"1","status":"done","errors":[],"result_url":"/superset/explore_json/data/ejr-37281682b1282cdb8f25e0de0339b386"}`;
      const message2 = `{"id":"1615426152516-0","channel_id":"${channelId}","job_id":"f1e5bb1f-f2f1-4f21-9b2f-c9b91dcc9b59","user_id":"1","status":"done","errors":[],"result_url":"/api/v1/chart/data/qc-64e8452dc9907dd77746cb75a19202de"}`;
      expect(sendMock).toHaveBeenCalledWith(message1);
      expect(sendMock).toHaveBeenCalledWith(message2);
    });

    test('channel not present', async () => {
      const ws = new wsMock('localhost');
      const sendMock = jest.spyOn(ws, 'send');

      expect(statsdIncrementMock).toBeCalledTimes(0);
      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toBeCalledTimes(0);

      expect(sendMock).not.toHaveBeenCalled();
    });

    test('error sending data to client', async () => {
      const ws = new wsMock('localhost');
      const sendMock = jest.spyOn(ws, 'send').mockImplementation(() => {
        throw new Error();
      });
      const cleanChannelMock = jest.spyOn(server, 'cleanChannel');
      const socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };

      expect(statsdIncrementMock).toBeCalledTimes(0);
      server.trackClient(channelId, socketInstance);
      expect(statsdIncrementMock).toBeCalledTimes(1);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        1,
        'ws_connected_client',
      );

      server.processStreamResults(streamReturnValue);
      expect(statsdIncrementMock).toBeCalledTimes(2);
      expect(statsdIncrementMock).toHaveBeenNthCalledWith(
        2,
        'ws_client_send_error',
      );

      expect(sendMock).toHaveBeenCalled();
      expect(cleanChannelMock).toHaveBeenCalledWith(channelId);

      cleanChannelMock.mockRestore();
    });
  });

  describe('fetchRangeFromStream', () => {
    beforeEach(() => {
      mockRedisXrange.mockClear();
    });

    test('success with results', async () => {
      mockRedisXrange.mockResolvedValueOnce(streamReturnValue);
      const cb = jest.fn();
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
      const cb = jest.fn();
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
      const cb = jest.fn();
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
    let wsEventMock: jest.SpyInstance;
    let trackClientSpy: jest.SpyInstance;
    let fetchRangeFromStreamSpy: jest.SpyInstance;
    let dateNowSpy: jest.SpyInstance;
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
      wsEventMock = jest.spyOn(ws, 'on');
      trackClientSpy = jest.spyOn(server, 'trackClient');
      fetchRangeFromStreamSpy = jest.spyOn(server, 'fetchRangeFromStream');
      dateNowSpy = jest
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
      wsEventMock.mockRestore();
      trackClientSpy.mockRestore();
      fetchRangeFromStreamSpy.mockRestore();
      dateNowSpy.mockRestore();
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

      expect(trackClientSpy).toHaveBeenCalledWith(
        channelId,
        socketInstanceExpected,
      );
      expect(fetchRangeFromStreamSpy).not.toHaveBeenCalled();
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    test('valid JWT, with lastId', async () => {
      const validToken = jwt.sign({ channel: channelId }, config.jwtSecret);
      const lastId = '1615426152415-0';
      const request = getRequest(
        validToken,
        `http://localhost?last_id=${lastId}`,
      );

      server.wsConnection(ws, request);

      expect(trackClientSpy).toHaveBeenCalledWith(
        channelId,
        socketInstanceExpected,
      );
      expect(fetchRangeFromStreamSpy).toHaveBeenCalledWith({
        sessionId: channelId,
        startId: '1615426152415-1',
        endId: '+',
        listener: server.processStreamResults,
      });
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

      expect(trackClientSpy).toHaveBeenCalledWith(
        channelId,
        socketInstanceExpected,
      );
      expect(fetchRangeFromStreamSpy).toHaveBeenCalledWith({
        sessionId: channelId,
        startId: '1615426152415-1',
        endId: lastFirehoseId,
        listener: server.processStreamResults,
      });
      expect(wsEventMock).toHaveBeenCalledWith('pong', expect.any(Function));
    });
  });

  describe('httpUpgrade', () => {
    let socket: net.Socket;
    let socketDestroySpy: jest.SpyInstance;
    let wssUpgradeSpy: jest.SpyInstance;

    const getRequest = (token: string, url: string): http.IncomingMessage => {
      const request = new http.IncomingMessage(new net.Socket());
      request.method = 'GET';
      request.headers = { cookie: `${config.jwtCookieName}=${token}` };
      request.url = url;
      return request;
    };

    beforeEach(() => {
      socket = new net.Socket();
      socketDestroySpy = jest.spyOn(socket, 'destroy');
      wssUpgradeSpy = jest.spyOn(server.wss, 'handleUpgrade');
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
  });

  const setReadyState = (ws: WebSocket, value: typeof ws.readyState) => {
    // workaround for not being able to do
    // spyOn(instance,'readyState','get').and.returnValue(value);
    // See for details: https://github.com/facebook/jest/issues/9675
    Object.defineProperty(ws, 'readyState', {
      configurable: true,
      get() {
        return value;
      },
    });
  };

  describe('checkSockets', () => {
    let ws: WebSocket;
    let pingSpy: jest.SpyInstance;
    let terminateSpy: jest.SpyInstance;
    let socketInstance: server.SocketInstance;

    beforeEach(() => {
      ws = new wsMock('localhost');
      pingSpy = jest.spyOn(ws, 'ping');
      terminateSpy = jest.spyOn(ws, 'terminate');
      socketInstance = { ws: ws, channel: channelId, pongTs: Date.now() };
    });

    test('active sockets', () => {
      setReadyState(ws, WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      server.checkSockets();

      expect(pingSpy).toHaveBeenCalled();
      expect(terminateSpy).not.toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(1);
    });

    test('stale sockets', () => {
      setReadyState(ws, WebSocket.OPEN);
      socketInstance.pongTs = Date.now() - 60000;
      server.trackClient(channelId, socketInstance);

      server.checkSockets();

      expect(pingSpy).not.toHaveBeenCalled();
      expect(terminateSpy).toHaveBeenCalled();
      expect(Object.keys(server.sockets).length).toBe(0);
    });

    test('closed sockets', () => {
      setReadyState(ws, WebSocket.CLOSED);
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
      setReadyState(ws, WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(1);
    });

    test('closing sockets', () => {
      setReadyState(ws, WebSocket.CLOSING);
      server.trackClient(channelId, socketInstance);

      server.cleanChannel(channelId);

      expect(server.channels[channelId]).toBeUndefined();
    });

    test('multiple sockets', () => {
      setReadyState(ws, WebSocket.OPEN);
      server.trackClient(channelId, socketInstance);

      const ws2 = new wsMock('localhost');
      setReadyState(ws2, WebSocket.OPEN);
      const socketInstance2 = {
        ws: ws2,
        channel: channelId,
        pongTs: Date.now(),
      };
      server.trackClient(channelId, socketInstance2);

      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(2);

      setReadyState(ws2, WebSocket.CLOSED);
      server.cleanChannel(channelId);

      expect(server.channels[channelId].sockets.length).toBe(1);
    });

    test('invalid channel', () => {
      // don't error
      server.cleanChannel(channelId);
    });
  });
});
