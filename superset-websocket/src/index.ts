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
import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import jwt, {
  type Algorithm,
  type JwtPayload as JsonWebTokenPayload,
} from 'jsonwebtoken';
import { parseCookie } from 'cookie';
import { Redis, RedisOptions } from 'ioredis';
import StatsD from 'hot-shots';

import { createLogger } from './logger.js';
import { buildConfig, RedisConfig } from './config.js';
import { checkServerIdentity, PeerCertificate } from 'tls';

const REALTIME_JWT_AUDIENCE = 'superset-websocket';
const REALTIME_JWT_ISSUER = 'superset';
const PRINCIPAL_TYPES = ['user', 'guest'] as const;
type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

interface RealtimeJwtPayload extends JsonWebTokenPayload {
  principal_type?: unknown;
  username?: unknown;
}

/**
 * The generic message the server forwards to browsers. Every connected socket
 * has a valid realtime JWT; a browser client routes on `channel`:
 *   - `entity-changes:<type>` - a lossy "an entity of this type changed"
 *     nudge, broadcast to every authenticated socket; `payload` carries opaque
 *     ids only (`{entity_type, id}`).
 *   - `realtime:<principalChannel>` - a targeted task/status browser message,
 *     delivered only to sockets whose JWT proves that principal identity and
 *     binds it to that channel; `payload` is feature-defined (e.g.
 *     `{task_id, status}`).
 */
export interface OutboundMessage {
  channel: string;
  payload: unknown;
}

interface TaskStatusSubscriber {
  principal_type: PrincipalType;
  sub: string;
}

interface TaskStatusRedisPayload {
  task_id: string;
  status: string;
  subscribers: TaskStatusSubscriber[];
}

export interface SocketIdentity {
  channel: string;
  principalType: PrincipalType;
  subject: string;
  username?: string;
  tokenExpiresAtMs: number;
}

export interface SocketInstance {
  ws: WebSocket;
  channel: string;
  identity?: SocketIdentity;
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

// A Redis connection dedicated to Pub/Sub: once a connection enters subscriber
// mode it can no longer issue ordinary commands, so this is kept separate from
// any future command connection.
const redisSubscriber = new Redis(buildRedisOpts(opts.redis));
redisSubscriber.on('error', (err: Error) => {
  logger.error(`Redis connection error: ${err.message}`);
});
const httpServer = http.createServer();
export const wss = new WebSocketServer({
  noServer: true,
  clientTracking: false,
});

const SOCKET_ACTIVE_STATES: number[] = [WebSocket.OPEN, WebSocket.CONNECTING];

// The Pub/Sub channel prefixes the server tails. These are a wire-protocol
// contract with the Superset producer (superset/tasks/manager.py:
// ENTITY_CHANGES_CHANNEL_PREFIX / TASK_STATUS_CHANNEL), NOT a deployment
// knob - an independent override on this side with no matching producer config
// would silently subscribe to channels nothing publishes to, so they are fixed
// constants that must stay in lockstep with the producer.
//
// Tier-1 entity-change nudges are broadcast to every authenticated socket;
// tier-2 task-status messages carry subscriber principals and are fanned out by
// this server to matching sockets only (see routeRedisMessage). Both are lossy
// (Pub/Sub is fire-and-forget); the browser's interval poll is the correctness
// backstop, so no stream replay / reconnection catch-up is needed.
const ENTITY_CHANGES_CHANNEL_PREFIX = 'entity-changes:';
const TASK_STATUS_CHANNEL = 'task-status';
const REALTIME_BROWSER_CHANNEL_PREFIX = 'realtime:';
const ENTITY_CHANGES_PATTERN = `${ENTITY_CHANGES_CHANNEL_PREFIX}*`;

// Backoff before retrying an initial Pub/Sub subscription that failed (e.g.
// Redis unreachable at startup); see subscribeToChannels.
const SUBSCRIBE_RETRY_MS = 5000;

// initialize internal registries
export let channels: Record<string, ChannelValue> = {};
export let sockets: Record<string, SocketInstance> = {};

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
 * Sends a single message to every socket registered on a channel.
 * A channel may have multiple connected sockets (e.g. one browser tab each);
 * this emits the message to all of them, leaving it to the client to decide
 * which are relevant to its current context.
 */
export const sendToChannel = (
  channel: string,
  message: OutboundMessage,
): void => {
  const strData = JSON.stringify(message);
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
 * Sends a message to every connected socket, regardless of channel. Used for
 * the lossy tier-1 entity-change nudges (`entity-changes:*`), which carry only
 * opaque ids and are broadcast to authenticated sockets - each client filters
 * to the ids it renders. Reuses `sendToChannel` per channel so backpressure and
 * cleanup apply uniformly.
 */
export const broadcastToAll = (message: OutboundMessage): void => {
  for (const channel in channels) {
    sendToChannel(channel, message);
  }
};

function isTaskStatusSubscriber(
  subscriber: unknown,
): subscriber is TaskStatusSubscriber {
  if (!subscriber || typeof subscriber !== 'object') {
    return false;
  }
  const candidate = subscriber as {
    principal_type?: unknown;
    sub?: unknown;
  };
  return (
    PRINCIPAL_TYPES.includes(candidate.principal_type as PrincipalType) &&
    typeof candidate.sub === 'string' &&
    candidate.sub.length > 0
  );
}

function isTaskStatusRedisPayload(
  payload: unknown,
): payload is TaskStatusRedisPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const candidate = payload as {
    task_id?: unknown;
    status?: unknown;
    subscribers?: unknown;
  };
  return (
    typeof candidate.task_id === 'string' &&
    typeof candidate.status === 'string' &&
    Array.isArray(candidate.subscribers) &&
    candidate.subscribers.every(isTaskStatusSubscriber)
  );
}

function channelForSubscriber(subscriber: TaskStatusSubscriber): string | null {
  if (subscriber.principal_type === 'user') {
    return `user:${subscriber.sub}`;
  }
  if (subscriber.sub.startsWith('guest:')) {
    return subscriber.sub;
  }
  return null;
}

/**
 * Fan out one task-status Redis message to every subscriber principal in the
 * payload. `subscribers` is a server-side routing field produced by Superset
 * from task subscribers; it is intentionally stripped from the browser payload.
 */
export const sendTaskStatusToSubscribers = (payload: unknown): void => {
  if (!isTaskStatusRedisPayload(payload)) {
    logger.error(`Invalid task status message on ${TASK_STATUS_CHANNEL}`);
    return;
  }

  const outboundPayload = {
    task_id: payload.task_id,
    status: payload.status,
  };
  const sent = new Set<string>();
  payload.subscribers.forEach(subscriber => {
    const channel = channelForSubscriber(subscriber);
    if (channel === null) return;
    if (sent.has(channel)) return;
    sent.add(channel);
    sendToChannel(channel, {
      channel: `${REALTIME_BROWSER_CHANNEL_PREFIX}${channel}`,
      payload: outboundPayload,
    });
  });
};

/**
 * Routes a raw Redis Pub/Sub message to the appropriate sockets.
 *
 * Task-status messages (`task-status`) include subscriber principals and are
 * fanned out to sockets whose JWT bound a matching routing key. Entity-change
 * messages (`entity-changes:<type>`) are broadcast to all sockets. Entity-change
 * messages forward the Redis channel name; task-status messages forward
 * `realtime:<routingKey>` and strip server-side routing fields.
 */
export const routeRedisMessage = (
  channel: string,
  rawMessage: string,
): void => {
  let payload: unknown;
  try {
    payload = JSON.parse(rawMessage);
  } catch (err) {
    logger.error(`Failed to parse message on channel ${channel}: ${err}`);
    return;
  }
  if (channel === TASK_STATUS_CHANNEL) {
    sendTaskStatusToSubscribers(payload);
  } else if (channel.startsWith(ENTITY_CHANGES_CHANNEL_PREFIX)) {
    const message: OutboundMessage = { channel, payload };
    broadcastToAll(message);
  } else {
    logger.debug(`Ignoring message on unrecognized channel ${channel}`);
  }
};

/**
 * Subscribes the Redis connection to tier-1 entity-change nudges and tier-2
 * task-status fanout messages.
 *
 * Failure is observable and self-healing rather than silent: if the initial
 * ``psubscribe`` rejects (e.g. Redis unreachable at startup) it is logged and
 * retried, so the transport can't end up running with no subscription. ioredis
 * additionally re-establishes these subscriptions automatically across
 * reconnects once they exist. Delivery is best-effort regardless - the browser's
 * interval poll is the correctness backstop.
 */
let pmessageBound = false;

export const subscribeToChannels = async (): Promise<void> => {
  // Bind the router exactly once; retries must not stack duplicate listeners
  // (which would route every message N times).
  if (!pmessageBound) {
    redisSubscriber.on(
      'pmessage',
      (_pattern: string, channel: string, message: string) => {
        routeRedisMessage(channel, message);
      },
    );
    pmessageBound = true;
  }
  try {
    await redisSubscriber.psubscribe(
      ENTITY_CHANGES_PATTERN,
      TASK_STATUS_CHANNEL,
    );
    logger.info(
      `Subscribed to Redis channels: ${ENTITY_CHANGES_PATTERN}, ${TASK_STATUS_CHANNEL}`,
    );
  } catch (err) {
    logger.error(
      `Failed to subscribe to Redis channels; retrying in ` +
        `${SUBSCRIBE_RETRY_MS}ms: ${err}`,
    );
    setTimeout(subscribeToChannels, SUBSCRIBE_RETRY_MS);
  }
};

/**
 * Verify and parse a realtime JWT cookie from an HTTP request.
 */
const readSocketIdentity = (request: http.IncomingMessage): SocketIdentity => {
  const cookies = parseCookie(request.headers.cookie || '');
  const token = cookies[opts.jwtCookieName];

  if (!token) throw new Error('JWT not present');
  const jwtPayload = jwt.verify(token, opts.jwtSecret, {
    algorithms: opts.jwtAlgorithms as Algorithm[],
    audience: REALTIME_JWT_AUDIENCE,
    complete: false,
    issuer: REALTIME_JWT_ISSUER,
  }) as RealtimeJwtPayload;
  const channelId = jwtPayload[opts.jwtChannelIdKey];
  const subject = jwtPayload.sub;
  const principalType = jwtPayload.principal_type;
  const expiresAtSeconds = jwtPayload.exp;

  if (typeof channelId !== 'string' || channelId.length === 0) {
    throw new Error('Channel ID not present in JWT');
  }
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new Error('Subject not present in JWT');
  }
  if (!PRINCIPAL_TYPES.includes(principalType as PrincipalType)) {
    throw new Error('Principal type not present in JWT');
  }
  const validatedPrincipalType = principalType as PrincipalType;
  if (validatedPrincipalType === 'user' && channelId !== `user:${subject}`) {
    throw new Error('Channel does not match JWT subject');
  }
  if (validatedPrincipalType === 'guest' && channelId !== subject) {
    throw new Error('Channel does not match JWT subject');
  }
  if (typeof expiresAtSeconds !== 'number') {
    throw new Error('Expiration not present in JWT');
  }
  const tokenExpiresAtMs = expiresAtSeconds * 1000;
  if (!Number.isFinite(tokenExpiresAtMs)) {
    throw new Error('Invalid JWT expiration');
  }

  return {
    channel: channelId,
    principalType: validatedPrincipalType,
    subject,
    username:
      typeof jwtPayload.username === 'string' ? jwtPayload.username : undefined,
    tokenExpiresAtMs,
  };
};

/**
 * WebSocket `connection` event handler, called via wss
 */
export const wsConnection = (ws: WebSocket, request: http.IncomingMessage) => {
  const identity = readSocketIdentity(request);
  const { channel } = identity;

  // Refuse the connection if a configured connection limit has been reached,
  // before tracking it against the internal registries.
  const limitReason = connectionLimitReason(channel);
  if (limitReason) {
    statsd.increment('ws_connection_rejected');
    logger.warn(`Refusing connection on channel ${channel}: ${limitReason}`);
    ws.close(CONNECTION_LIMIT_CLOSE_CODE, limitReason);
    return;
  }

  const socketInstance: SocketInstance = {
    ws,
    channel,
    identity,
    pongTs: Date.now(),
  };

  // add this ws instance to the internal registry
  const socketId = trackClient(channel, socketInstance);
  logger.debug(`socket ${socketId} connected on channel ${channel}`);

  // Pub/Sub is lossy and not replayable, so there is no server-side catch-up on
  // reconnect: the browser's interval poll reconciles any missed nudges.

  // init event handler for `pong` events (connection management)
  ws.on('pong', function pong(data: Buffer) {
    const socketId = data.toString();
    // `sockets` is a plain object, so an unsolicited pong carrying an
    // inherited key ('__proto__', 'constructor', 'hasOwnProperty', ...) as
    // its payload would otherwise resolve through the prototype chain
    // instead of missing outright, letting a client write an enumerable
    // `pongTs` onto Object.prototype (tripped over by the for...in loops in
    // checkSockets/cleanChannel on every GC pass). Guarding with an
    // own-property check rejects every such key in one place.
    if (!Object.prototype.hasOwnProperty.call(sockets, socketId)) {
      logger.warn(`pong received for nonexistent socket ${socketId}`);
      return;
    }
    sockets[socketId].pongTs = Date.now();
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
    readSocketIdentity(request);
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
    const now = Date.now();
    const timeout = now - socketInstance.pongTs;
    let isActive = true;

    if (
      socketInstance.identity &&
      now >= socketInstance.identity.tokenExpiresAtMs
    ) {
      logger.debug(
        `terminating socket with expired token: ${socketId}, channel: ${socketInstance.channel}`,
      );
      statsd.increment('ws_token_expired_disconnect');
      socketInstance.ws.terminate();
      isActive = false;
    } else if (timeout >= opts.socketResponseTimeoutMs) {
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

  // start receiving realtime messages from Redis Pub/Sub
  subscribeToChannels();

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
  pmessageBound = false;
};
