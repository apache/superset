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
import * as http from 'http';
import * as net from 'net';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import jwt, { Algorithm } from 'jsonwebtoken';
import cookie from 'cookie';
import Redis, { RedisOptions } from 'ioredis';
import StatsD from 'hot-shots';

import { createLogger } from './logger';
import { buildConfig, RedisConfig } from './config';
import { checkServerIdentity, PeerCertificate } from 'tls';

export type StreamResult = [
  recordId: string,
  record: [label: 'data', data: string],
];

// sync with superset-frontend/src/components/ErrorMessage/types
export type ErrorLevel = 'info' | 'warning' | 'error';
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export type SupersetError<ExtraType = Record<string, any> | null> = {
  error_type: string;
  extra: ExtraType;
  level: ErrorLevel;
  message: string;
};

type ListenerFunction = (results: StreamResult[]) => void;
interface EventValue {
  id: string;
  channel_id: string;
  job_id: string;
  user_id?: string;
  status: string;
  errors?: SupersetError[];
  result_url?: string;
}
interface JwtPayload {
  [key: string]: string;
}
interface FetchRangeFromStreamParams {
  sessionId: string;
  startId: string;
  endId: string;
  listener: ListenerFunction;
}
export interface SocketInstance {
  ws: WebSocket;
  channel: string;
  pongTs: number;
}

interface ChannelValue {
  sockets: Array<string>;
}

const environment = process.env.NODE_ENV;

const startServer = process.argv[2] === 'start';

export const opts = buildConfig();

// init logger
const logger = createLogger({
  silent: environment === 'test',
  logLevel: opts.logLevel,
  logToFile: opts.logToFile,
  logFilename: opts.logFilename,
});

export const statsd = new StatsD({
  ...opts.statsd,
  errorHandler: (e: Error) => {
    logger.error(e);
  },
});

// enforce JWT secret length
if (startServer && opts.jwtSecret.length < 32) {
  console.error('ERROR: Please provide a JWT secret at least 32 bytes long');
  process.exit(1);
}

if (startServer && opts.jwtSecret.startsWith('CHANGE-ME')) {
  console.warn(
    'WARNING: it appears you secret in your config.json is insecure',
  );
  console.warn('DO NOT USE IN PRODUCTION');
}

export const buildRedisOpts = (baseConfig: RedisConfig) => {
  const redisOpts: RedisOptions = {
    port: baseConfig.port,
    host: baseConfig.host,
    db: baseConfig.db,
  };

  const passwd = baseConfig.password;
  if (passwd !== '') {
    redisOpts.username = baseConfig.username;
    redisOpts.password = baseConfig.password;
  }

  if (baseConfig.ssl) {
    redisOpts.tls = {
      checkServerIdentity: (
        hostname: string,
        cert: PeerCertificate,
      ): Error | undefined => {
        // Note, the cert chain will have been verified already. the role of this method is to
        // validate that at least one of the SAN's (or subject) of the server's cert matches the provided hostname
        if (baseConfig.validateHostname) {
          return checkServerIdentity(hostname, cert);
        }
      },
    };
  }

  return redisOpts;
};

// initialize servers
const redis = new Redis(buildRedisOpts(opts.redis));
const httpServer = http.createServer();
export const wss = new WebSocket.Server({
  noServer: true,
  clientTracking: false,
});

const SOCKET_ACTIVE_STATES: number[] = [WebSocket.OPEN, WebSocket.CONNECTING];
const GLOBAL_EVENT_STREAM_NAME = `${opts.redisStreamPrefix}full`;
const DEFAULT_STREAM_LAST_ID = '$';

// initialize internal registries
export let channels: Record<string, ChannelValue> = {};
export let sockets: Record<string, SocketInstance> = {};
let lastFirehoseId: string = DEFAULT_STREAM_LAST_ID;

export const setLastFirehoseId = (id: string): void => {
  lastFirehoseId = id;
};

/**
 * Adds the passed channel and socket instance to the internal registries.
 */
export const trackClient = (
  channel: string,
  socketInstance: SocketInstance,
): string => {
  statsd.increment('ws_connected_client');

  const socketId = uuidv4();
  sockets[socketId] = socketInstance;

  if (channel in channels) {
    channels[channel].sockets.push(socketId);
  } else {
    channels[channel] = { sockets: [socketId] };
  }

  return socketId;
};

/**
 * Sends a single async event payload to a single channel.
 * A channel may have multiple connected sockets, this emits
 * the event to all connected sockets within a channel.
 */
export const sendToChannel = (channel: string, value: EventValue): void => {
  const strData = JSON.stringify(value);
  if (!channels[channel]) {
    logger.debug(`channel ${channel} is unknown, skipping`);
    return;
  }
  channels[channel].sockets.forEach(socketId => {
    const socketInstance: SocketInstance = sockets[socketId];
    if (!socketInstance) return cleanChannel(channel);
    try {
      socketInstance.ws.send(strData);
    } catch (err) {
      statsd.increment('ws_client_send_error');
      logger.debug(`Error sending to socket: ${err}`);
      // check that the connection is still active
      cleanChannel(channel);
    }
  });
};

/**
 * Reads a range of events from a channel-specific Redis event stream.
 * Invoked in the client re-connection flow.
 */
export const fetchRangeFromStream = async ({
  sessionId,
  startId,
  endId,
  listener,
}: FetchRangeFromStreamParams) => {
  const streamName = `${opts.redisStreamPrefix}${sessionId}`;
  try {
    const reply = await redis.xrange(streamName, startId, endId);
    if (!reply || !reply.length) return;
    listener(reply as StreamResult[]);
  } catch (e) {
    logger.error(e);
  }
};

/**
 * Reads from the global Redis event stream continuously.
 * Utilizes a blocking connection to Redis to wait for data to
 * be returned from the stream.
 */
export const subscribeToGlobalStream = async (
  stream: string,
  listener: ListenerFunction,
) => {
  /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/
  while (true) {
    try {
      const reply = await redis.xread(
        'BLOCK',
        opts.redisStreamReadBlockMs,
        'COUNT',
        opts.redisStreamReadCount,
        'STREAMS',
        stream,
        lastFirehoseId,
      );
      if (!reply) {
        continue;
      }
      const results = reply[0][1];
      const { length } = results;
      if (!results.length) {
        continue;
      }
      listener(results as StreamResult[]);
      setLastFirehoseId(results[length - 1][0]);
    } catch (e) {
      logger.error(e);
      continue;
    }
  }
};

/**
 * Callback function to process events received from a Redis Stream
 */
export const processStreamResults = (results: StreamResult[]): void => {
  logger.debug(`events received: ${results}`);
  results.forEach(item => {
    try {
      const id = item[0];
      const data = JSON.parse(item[1][1]);
      sendToChannel(data.channel_id, { id, ...data });
    } catch (err) {
      logger.error(err);
    }
  });
};

/**
 * Verify and parse a JWT cookie from an HTTP request.
 * Returns the channelId from the JWT payload found in the cookie
 * configured via 'jwtCookieName' in the config.
 */
const readChannelId = (request: http.IncomingMessage): string => {
  const cookies = cookie.parse(request.headers.cookie || '');
  const token = cookies[opts.jwtCookieName];

  if (!token) throw new Error('JWT not present');
  const jwtPayload = jwt.verify(token, opts.jwtSecret, {
    algorithms: opts.jwtAlgorithms as Algorithm[],
    complete: false,
  }) as JwtPayload;
  const channelId = jwtPayload[opts.jwtChannelIdKey];

  if (!channelId) throw new Error('Channel ID not present in JWT');

  return channelId;
};

/**
 * Extracts the `last_id` query param value from an HTTP request
 */
const getLastId = (request: http.IncomingMessage): string | null => {
  const url = new URL(String(request.url), 'http://0.0.0.0');
  const queryParams = url.searchParams;
  return queryParams.get('last_id');
};

/**
 * Increments a Redis Stream ID
 */
export const incrementId = (id: string): string => {
  // redis stream IDs are in this format: '1607477697866-0'
  const parts = id.split('-');
  if (parts.length < 2) return id;
  return parts[0] + '-' + (Number(parts[1]) + 1);
};

/**
 * WebSocket `connection` event handler, called via wss
 */
export const wsConnection = (ws: WebSocket, request: http.IncomingMessage) => {
  const channel: string = readChannelId(request);
  const socketInstance: SocketInstance = { ws, channel, pongTs: Date.now() };

  // add this ws instance to the internal registry
  const socketId = trackClient(channel, socketInstance);
  logger.debug(`socket ${socketId} connected on channel ${channel}`);

  // reconnection logic
  const lastId = getLastId(request);
  if (lastId) {
    // fetch range of events from lastId to most recent event received on
    // via global event stream
    const endId =
      lastFirehoseId === DEFAULT_STREAM_LAST_ID ? '+' : lastFirehoseId;
    fetchRangeFromStream({
      sessionId: channel,
      startId: incrementId(lastId), // inclusive
      endId, // inclusive
      listener: processStreamResults,
    });
  }

  // init event handler for `pong` events (connection management)
  ws.on('pong', function pong(data: Buffer) {
    const socketId = data.toString();
    const socketInstance = sockets[socketId];
    if (!socketInstance) {
      logger.warn(`pong received for nonexistent socket ${socketId}`);
    } else {
      socketInstance.pongTs = Date.now();
    }
  });
};

/**
 * HTTP `request` event handler, called via httpServer
 */
export const httpRequest = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
) => {
  const rawUrl = request.url as string;
  const method = request.method as string;
  const headers = request.headers || {};
  const url = new URL(rawUrl as string, `http://${headers.host}`);
  if (url.pathname === '/health' && ['GET', 'HEAD'].includes(method)) {
    response.writeHead(200);
    response.end('OK');
  } else {
    logger.info(`Received unexpected request: ${method} ${rawUrl}`);
    response.writeHead(404);
    response.end('Not Found');
  }
};

/**
 * HTTP `upgrade` event handler, called via httpServer
 */
export const httpUpgrade = (
  request: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
) => {
  try {
    readChannelId(request);
  } catch (err) {
    // JWT invalid, do not establish a WebSocket connection
    logger.error(err);
    socket.destroy();
    return;
  }

  // upgrade the HTTP request into a WebSocket connection
  wss.handleUpgrade(
    request,
    socket,
    head,
    function cb(ws: WebSocket, request: http.IncomingMessage) {
      wss.emit('connection', ws, request);
    },
  );
};

// Connection cleanup and garbage collection

/**
 * Iterate over all tracked sockets, terminating and removing references to
 * connections that have not responded with a _pong_ within the timeout window.
 * Sends a _ping_ to all active connections.
 */
export const checkSockets = () => {
  logger.debug(`channel count: ${Object.keys(channels).length}`);
  logger.debug(`socket count: ${Object.keys(sockets).length}`);
  for (const socketId in sockets) {
    const socketInstance = sockets[socketId];
    const timeout = Date.now() - socketInstance.pongTs;
    let isActive = true;

    if (timeout >= opts.socketResponseTimeoutMs) {
      logger.debug(
        `terminating unresponsive socket: ${socketId}, channel: ${socketInstance.channel}`,
      );
      socketInstance.ws.terminate();
      isActive = false;
    } else if (!SOCKET_ACTIVE_STATES.includes(socketInstance.ws.readyState)) {
      isActive = false;
    }

    if (isActive) {
      socketInstance.ws.ping(socketId);
    } else {
      delete sockets[socketId];
      logger.debug(`forgetting socket ${socketId}`);
    }
  }
};

/**
 * Iterate over all sockets within a channel, removing references to
 * inactive connections, ultimately removing the channel from the
 * _channels_ registry if no active connections remain.
 */
export const cleanChannel = (channel: string) => {
  const activeSockets: string[] =
    channels[channel]?.sockets.filter(socketId => {
      const socketInstance = sockets[socketId];
      if (!socketInstance) return false;
      if (SOCKET_ACTIVE_STATES.includes(socketInstance.ws.readyState))
        return true;
      return false;
    }) || [];

  if (activeSockets.length === 0) {
    delete channels[channel];
  } else {
    channels[channel].sockets = activeSockets;
  }
};

// server startup

if (startServer) {
  // init server event listeners
  wss.on('connection', function (ws) {
    ws.on('error', console.error);
  });
  wss.on('connection', wsConnection);
  httpServer.on('request', httpRequest);
  httpServer.on('upgrade', httpUpgrade);
  httpServer.listen(opts.port);
  logger.info(`Server started on port ${opts.port}`);

  // start reading from event stream
  subscribeToGlobalStream(GLOBAL_EVENT_STREAM_NAME, processStreamResults);

  // init garbage collection routines
  setInterval(checkSockets, opts.pingSocketsIntervalMs);
  setInterval(function gc() {
    // clean all channels
    for (const channel in channels) {
      cleanChannel(channel);
    }
  }, opts.gcChannelsIntervalMs);
}

// test utilities

export const resetState = () => {
  channels = {};
  sockets = {};
  lastFirehoseId = DEFAULT_STREAM_LAST_ID;
};
