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
import { inspect } from 'util';
import WebSocket, { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import jwt, { Algorithm } from 'jsonwebtoken';
import { parse } from 'cookie';
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

type ListenerFunction = (results: StreamResult[]) => void | Promise<void>;
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
  logger.error('Please provide a JWT secret at least 32 bytes long');
  process.exit(1);
}

if (startServer && opts.jwtSecret.startsWith('CHANGE-ME')) {
  logger.warn(
    'It appears your secret in your config.json is insecure. ' +
      'DO NOT USE IN PRODUCTION',
  );
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
redis.on('error', (err: Error) => {
  logger.error(`Redis connection error: ${err.message}`);
});
const httpServer = http.createServer();
export const wss = new WebSocketServer({
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

// WebSocket close code used when a connection is refused because a configured
// connection limit has been reached (1013 = "Try Again Later").
const CONNECTION_LIMIT_CLOSE_CODE = 1013;

/**
 * Returns whether the socket with the given id is currently active, i.e. it is
 * still registered and its underlying connection is in an active readyState.
 *
 * Closed sockets are only removed from the registries asynchronously (via the
 * `checkSockets`/`cleanChannel` GC routines), so connection-limit checks must
 * filter on live socket state rather than trusting the raw registry sizes.
 */
export const isSocketActive = (socketId: string): boolean => {
  const socketInstance = sockets[socketId];
  return (
    !!socketInstance &&
    SOCKET_ACTIVE_STATES.includes(socketInstance.ws.readyState)
  );
};

/**
 * Counts the sockets in the global registry that are still active.
 */
export const activeSocketCount = (): number =>
  Object.keys(sockets).filter(isSocketActive).length;

/**
 * Counts the active sockets currently registered on the given channel.
 */
export const activeChannelSocketCount = (channel: string): number =>
  channels[channel]?.sockets.filter(isSocketActive).length ?? 0;

/**
 * Determines whether accepting a new connection on the given channel would
 * exceed a configured connection limit. Returns a human-readable reason when a
 * limit is reached, or `null` when the connection is within limits.
 *
 * Both limits are opt-in: a value of `0` (the default) disables the check.
 *
 * Counts are derived from active socket state rather than raw registry sizes:
 * recently closed sockets linger in the registries until the next GC pass, so
 * counting them would spuriously reject new connections even when no active
 * connection is consuming capacity.
 */
export const connectionLimitReason = (channel: string): string | null => {
  const { maxTotalConnections, maxConnectionsPerChannel } = opts;

  if (maxTotalConnections > 0 && activeSocketCount() >= maxTotalConnections) {
    return `total connection limit (${maxTotalConnections}) reached`;
  }

  if (
    maxConnectionsPerChannel > 0 &&
    activeChannelSocketCount(channel) >= maxConnectionsPerChannel
  ) {
    return `per-channel connection limit (${maxConnectionsPerChannel}) reached`;
  }

  return null;
};

/**
 * Adds the passed channel and socket instance to the internal registries.
 */
export const trackClient = (
  channel: string,
  socketInstance: SocketInstance,
): string => {
  statsd.increment('ws_connected_client');

  const socketId = randomUUID();
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
    // Backpressure: if a slow or stalled client has let its outbound buffer
    // grow past the configured cap, terminate it rather than buffering
    // unbounded data in server memory. Opt-in: a cap of 0 disables the check.
    const { maxSocketBufferBytes } = opts;
    if (
      maxSocketBufferBytes > 0 &&
      socketInstance.ws.bufferedAmount > maxSocketBufferBytes
    ) {
      statsd.increment('ws_client_backpressure_disconnect');
      logger.warn(
        `Terminating socket on channel ${channel}: send buffer ` +
          `(${socketInstance.ws.bufferedAmount} bytes) exceeded the ` +
          `configured limit (${maxSocketBufferBytes} bytes)`,
      );
      socketInstance.ws.terminate();
      // Drop the terminated socket from the global registry immediately
      // rather than waiting for the next checkSockets sweep, so a burst of
      // slow clients doesn't leave dead entries resident between pings.
      delete sockets[socketId];
      cleanChannel(channel);
      return;
    }
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
    await listener(reply as StreamResult[]);
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
        'COUNT',
        opts.redisStreamReadCount,
        'BLOCK',
        opts.redisStreamReadBlockMs,
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
      // Await the listener before advancing so that batches are processed
      // sequentially. processStreamResults yields to the event loop mid-batch
      // for large bursts; without awaiting here a subsequent xread could start
      // a concurrent batch and interleave out-of-order sends to clients.
      await listener(results as StreamResult[]);
      setLastFirehoseId(results[length - 1][0]);
    } catch (e) {
      logger.error(e);
      continue;
    }
  }
};

/**
 * Callback function to process events received from a Redis Stream.
 *
 * For large batches the loop periodically yields to the Node.js event loop
 * (via setImmediate) so that connection management, health checks and
 * ping/pong handling are not starved while a burst of events is processed.
 * The yield cadence is controlled by `eventYieldBatchSize` (0 disables it).
 */
export const processStreamResults = async (
  results: StreamResult[],
): Promise<void> => {
  // Log only the batch size, not the raw payloads, which carry user and
  // job identifiers.
  logger.debug(`events received: count=${results.length}`);
  const { eventYieldBatchSize } = opts;
  for (let i = 0; i < results.length; i += 1) {
    if (eventYieldBatchSize > 0 && i > 0 && i % eventYieldBatchSize === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
    try {
      const item = results[i];
      const id = item[0];
      const data = JSON.parse(item[1][1]);
      sendToChannel(data.channel_id, { id, ...data });
    } catch (err) {
      logger.error(err);
    }
  }
};

/**
 * Verify and parse a JWT cookie from an HTTP request.
 * Returns the channelId from the JWT payload found in the cookie
 * configured via 'jwtCookieName' in the config.
 */
const readChannelId = (request: http.IncomingMessage): string => {
  const cookies = parse(request.headers.cookie || '');
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

// Redis stream IDs have the form '<millisecondsTime>-<sequenceNumber>',
// e.g. '1607477697866-0'.
const REDIS_STREAM_ID_REGEX = /^\d{1,15}-\d{1,10}$/;

/**
 * Extracts the `last_id` query param value from an HTTP request, returning it
 * only when it is a well-formed Redis stream ID. Malformed values are ignored
 * (returns null) rather than being passed through to incrementId / Redis.
 */
export const getLastId = (request: http.IncomingMessage): string | null => {
  const url = new URL(String(request.url), 'http://0.0.0.0');
  const lastId = url.searchParams.get('last_id');
  if (lastId === null) return null;
  if (!REDIS_STREAM_ID_REGEX.test(lastId)) {
    logger.warn(`Ignoring malformed last_id query param: ${lastId}`);
    return null;
  }
  return lastId;
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

  // Refuse the connection if a configured connection limit has been reached,
  // before tracking it against the internal registries.
  const limitReason = connectionLimitReason(channel);
  if (limitReason) {
    statsd.increment('ws_connection_rejected');
    logger.warn(`Refusing connection on channel ${channel}: ${limitReason}`);
    ws.close(CONNECTION_LIMIT_CLOSE_CODE, limitReason);
    return;
  }

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
 * Validates the `Origin` header of a WebSocket upgrade request against the
 * configured `allowedOrigins` list, mitigating Cross-Site WebSocket Hijacking.
 *
 * When `allowedOrigins` is empty the check is skipped (preserving existing
 * behavior); a single `'*'` entry explicitly allows any origin. Otherwise the
 * request's `Origin` must exactly match one of the configured origins.
 */
export const isOriginAllowed = (request: http.IncomingMessage): boolean => {
  const { allowedOrigins } = opts;

  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true;
  }
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // `origin` is typed as `string | string[] | undefined`; only a single,
  // unambiguous string header is acceptable for an exact-match comparison.
  const origin = request.headers.origin;
  if (typeof origin !== 'string') {
    return false;
  }
  return allowedOrigins.includes(origin);
};

/**
 * HTTP `upgrade` event handler, called via httpServer
 */
export const httpUpgrade = (
  request: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
) => {
  if (!isOriginAllowed(request)) {
    logger.error(
      `Rejecting WebSocket upgrade from disallowed origin: ${
        request.headers.origin || '(none)'
      }`,
    );
    socket.destroy();
    return;
  }

  try {
    readChannelId(request);
  } catch (err) {
    // Token invalid/absent: do not establish a WebSocket connection. Record a
    // structured warning (with the request's remote address) so rejected
    // upgrade attempts are auditable, without logging the token itself.
    statsd.increment('ws_upgrade_rejected');
    logger.warn(
      `Rejected WebSocket upgrade from ${request.socket.remoteAddress ?? 'unknown'}: ` +
        `${(err as Error).message}`,
    );
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
  // Last-resort handlers so an unhandled async error is recorded through the
  // configured logger instead of printing a default trace (or, for an
  // unhandled rejection, terminating the process on newer Node versions).
  process.on('unhandledRejection', (reason: unknown) => {
    // Normalize the reason defensively: a raw template interpolation throws on
    // a Symbol (or other exotic value), which would crash this last-resort
    // handler. `inspect` safely stringifies any value.
    logger.error(`Unhandled promise rejection: ${inspect(reason)}`);
  });
  process.on('uncaughtException', (err: unknown) => {
    // JavaScript can throw non-Error values (including null), so guard the
    // shape before dereferencing instead of assuming an Error is present.
    const detail =
      err instanceof Error ? (err.stack ?? err.message) : inspect(err);
    logger.error(`Uncaught exception: ${detail}`);
  });

  // init server event listeners
  wss.on('connection', function (ws: WebSocket) {
    ws.on('error', (err: Error) =>
      logger.error(`socket error: ${err.message}`),
    );
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
