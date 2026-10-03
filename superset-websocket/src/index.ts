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

const isPrincipalType = (value: unknown): value is PrincipalType =>
  typeof value === 'string' && PRINCIPAL_TYPES.some(type => type === value);

/**
 * The claims this server reads out of a realtime JWT, beyond the registered ones
 * (`sub`, `exp`, `aud`, `iss`) that `jsonwebtoken` already types. The claim names
 * are fixed rather than configurable: the Flask app mints them unconditionally
 * (superset/websocket/channel.py) with no counterpart setting to rename them, so
 * an override on this side could only ever break the pairing.
 */
interface RealtimeJwtPayload extends JsonWebTokenPayload {
  channel?: unknown;
  principal_type?: unknown;
}

/**
 * The generic envelope the server forwards to browsers. Every connected socket
 * has a valid realtime JWT. A browser client dispatches on `topic` (the semantic
 * stream), never on the route it arrived by:
 *   - `entity.changed` - a lossy "an entity changed" nudge broadcast to every
 *     authenticated socket; `payload` carries opaque ids only (`{entity_type, id}`).
 *   - `task.status` - a targeted task/status message delivered only to the sockets
 *     the producer routed to; `payload` is feature-defined (e.g. `{task_id, status}`).
 * The server-side routing keys never reach the browser.
 */
export interface OutboundMessage {
  topic: string;
  payload: unknown;
}

/**
 * A Redis message from the Superset producer. Self-describing: `topic` is the
 * semantic stream forwarded to the browser, `scope` is the delivery breadth the
 * server routes by (`authenticated_global` => broadcast; otherwise targeted to
 * `routes`), `routes` are the server-side routing keys (present for a targeted
 * scope, absent/ignored for a broadcast), and `payload` is forwarded verbatim.
 */
interface RealtimeEnvelope {
  topic: string;
  scope: string;
  routes?: string[];
  payload: unknown;
}

export interface SocketIdentity {
  channel: string;
  principalType: PrincipalType;
  subject: string;
  tokenExpiresAtMs: number;
}

export interface SocketInstance {
  ws: WebSocket;
  channel: string;
  // Additional per-tab channel the socket is also registered under, when the
  // browser advertised a `tab_id` at connect (`<channel>:<tabId>`).
  tabChannel?: string;
  identity: SocketIdentity;
  pongTs: number;
}

interface ChannelValue {
  sockets: Array<string>;
}

const environment = process.env.NODE_ENV;

const startServer = process.argv[2] === 'start';

export const opts = buildConfig();

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

const validateConfiguredJwtSecret = (
  secret: string,
  name: string,
  required = false,
) => {
  if (!secret && !required) return;
  if (secret.length < 32) {
    logger.error(`Please provide a ${name} at least 32 bytes long`);
    process.exit(1);
  }
  if (secret.startsWith('CHANGE-ME')) {
    logger.warn(
      `It appears your ${name} in your config.json is insecure. ` +
        'DO NOT USE IN PRODUCTION',
    );
  }
};

if (startServer) {
  validateConfiguredJwtSecret(opts.jwtSecret, 'JWT secret', true);
  validateConfiguredJwtSecret(opts.previousJwtSecret, 'previous JWT secret');
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
// mode it can no longer issue ordinary commands, so subscriptions need a
// connection of their own.
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

// The single Pub/Sub channel the server tails. This is a wire-protocol contract
// with the Superset producer (superset/tasks/manager.py). The name is
// `${prefix}realtime`, where the prefix comes from REALTIME_CHANNEL_PREFIX (empty
// by default). Redis Pub/Sub is not scoped by DB number, so deployments sharing
// one Redis/Valkey set a per-deployment prefix to isolate their channels — it MUST
// be set identically here and on the producer (Flask REALTIME_CHANNEL_PREFIX),
// since a mismatch would subscribe to a channel nothing publishes to.
const REALTIME_CHANNEL = `${opts.realtimeChannelPrefix}realtime`;

// Envelope scopes (delivery breadth), mirrored from the producer. A message is
// broadcast to every authenticated socket when its scope is `authenticated_global`,
// and otherwise targeted to the routing keys it names.
const SCOPE_AUTHENTICATED_GLOBAL = 'authenticated_global';

// Bound on a client-supplied tab id before it is concatenated into a channel key
// (`<channel>:<tabId>`). The principal prefix is server-derived, but the tab
// suffix is client-controlled, so cap its length and restrict its charset. Kept
// in lockstep with the Flask ingress guard (superset/tasks/subscription.py).
const TAB_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const isValidTabId = (value: string): boolean => TAB_ID_PATTERN.test(value);

// Backoff before retrying an initial Pub/Sub subscription that failed (e.g.
// Redis unreachable at startup); see subscribeToChannels.
const SUBSCRIBE_RETRY_MS = 5000;

export let channels: Record<string, ChannelValue> = {};
export let sockets: Record<string, SocketInstance> = {};

// WebSocket close code used when a connection is refused because a configured
// connection limit has been reached (1013 = "Try Again Later").
const CONNECTION_LIMIT_CLOSE_CODE = 1013;

// The Redis Pub/Sub subscriber is the server's only source of realtime messages.
// If it drops, a browser socket can stay open while the server silently misses
// messages, so subscriber health gates the transport: while unhealthy, new
// upgrades are refused and existing sockets are closed with a retryable code
// (1012 = "Service Restart") so clients reconnect and run their status_changes
// catch-up once the subscriber is healthy again. (Left off /health, which is a
// liveness probe — coupling it to a transient Redis blip would churn pods.)
const SUBSCRIBER_UNHEALTHY_CLOSE_CODE = 1012;
export let subscriberHealthy = false;

export const markSubscriberHealthy = (): void => {
  if (subscriberHealthy) return;
  subscriberHealthy = true;
  logger.info('Redis subscriber healthy; realtime transport available');
};

export const markSubscriberUnhealthy = (reason: string): void => {
  if (!subscriberHealthy) return; // act only on the healthy -> unhealthy edge
  subscriberHealthy = false;
  logger.warn(
    `Redis subscriber unhealthy (${reason}); refusing upgrades and closing ` +
      `sockets so clients reconnect and catch up`,
  );
  // Snapshot ids first: ws.close triggers the 'close' handler, which deletes from
  // `sockets` — mutating the object mid-iteration.
  Object.keys(sockets).forEach(socketId => {
    try {
      sockets[socketId]?.ws.close(
        SUBSCRIBER_UNHEALTHY_CLOSE_CODE,
        'realtime backend unavailable',
      );
    } catch (err) {
      logger.error(
        `Failed to close socket ${socketId} on subscriber loss: ${err}`,
      );
    }
  });
};

// A dropped/ended subscriber connection means missed messages; ioredis
// auto-reconnects (and re-subscribes), and the 'ready' handler below reconfirms
// the subscription and flips back to healthy.
redisSubscriber.on('close', () => markSubscriberUnhealthy('connection closed'));
redisSubscriber.on('end', () => markSubscriberUnhealthy('connection ended'));

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
 * Sends one already-serialized message to a single socket, applying backpressure
 * and cleanup. Returns whether the send succeeded. When `cleanupChannel` is
 * given, a missing/terminated/errored socket triggers a `cleanChannel` on it;
 * broadcast callers omit it (the next targeted send or GC prunes the socket).
 */
const sendToSocket = (
  socketId: string,
  strData: string,
  cleanupChannel?: string,
): boolean => {
  const socketInstance: SocketInstance = sockets[socketId];
  if (!socketInstance) {
    if (cleanupChannel) cleanChannel(cleanupChannel);
    return false;
  }
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
      `Terminating socket ${socketId}: send buffer ` +
        `(${socketInstance.ws.bufferedAmount} bytes) exceeded the ` +
        `configured limit (${maxSocketBufferBytes} bytes)`,
    );
    socketInstance.ws.terminate();
    // Drop the terminated socket from the global registry immediately
    // rather than waiting for the next checkSockets sweep, so a burst of
    // slow clients doesn't leave dead entries resident between pings.
    delete sockets[socketId];
    if (cleanupChannel) cleanChannel(cleanupChannel);
    return false;
  }
  try {
    socketInstance.ws.send(strData);
    return true;
  } catch (err) {
    statsd.increment('ws_client_send_error');
    logger.debug(`Error sending to socket: ${err}`);
    if (cleanupChannel) cleanChannel(cleanupChannel);
    return false;
  }
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
  let sentCount = 0;
  // Iterate a copy: a failed send may cleanChannel and mutate the sockets list.
  channels[channel].sockets.slice().forEach(socketId => {
    if (sendToSocket(socketId, strData, channel)) sentCount += 1;
  });
  logger.debug(
    `Forwarded ${message.topic} to ${sentCount} socket(s) on channel ${channel}`,
  );
};

/**
 * Sends a message to every connected socket, regardless of channel. Used for the
 * `authenticated_global` broadcast scope (e.g. lossy `entity.changed` nudges),
 * which carries only opaque ids - each client filters to the ids it renders.
 * Iterates the unique socket registry (not per channel) so a socket registered
 * under both its principal and its per-tab channel still receives each broadcast
 * exactly once.
 */
export const broadcastToAll = (message: OutboundMessage): void => {
  const strData = JSON.stringify(message);
  Object.keys(sockets).forEach(socketId => {
    sendToSocket(socketId, strData);
  });
};

/**
 * Validate and narrow a parsed Redis message to a RealtimeEnvelope, or return
 * null (logging) when it is malformed. A targeted (non-broadcast) envelope must
 * carry a non-empty `routes` array of non-empty strings; a broadcast may omit it.
 */
function parseRealtimeEnvelope(payload: unknown): RealtimeEnvelope | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as {
    topic?: unknown;
    scope?: unknown;
    routes?: unknown;
    payload?: unknown;
  };
  if (typeof candidate.topic !== 'string' || candidate.topic.length === 0) {
    return null;
  }
  if (typeof candidate.scope !== 'string' || candidate.scope.length === 0) {
    return null;
  }
  let routes: string[] | undefined;
  if (candidate.routes !== undefined) {
    if (
      !Array.isArray(candidate.routes) ||
      !candidate.routes.every(
        route => typeof route === 'string' && route.length > 0,
      )
    ) {
      return null;
    }
    routes = candidate.routes as string[];
  }
  return {
    topic: candidate.topic,
    scope: candidate.scope,
    routes,
    payload: candidate.payload,
  };
}

/**
 * Derive a principal's socket routing key, or `null` when the identity does not
 * name one. Mirrors the backend's single source of truth (`channel_id_for` in
 * superset/websocket/channel.py): `user:<id>` for an authenticated user, and the
 * guest's already-namespaced `guest:<hmac>` key for an embedded guest.
 *
 * Both directions go through this one function so an accepted socket and an
 * outbound fanout can never disagree on the key: it derives the channel a
 * connecting socket's JWT must claim, and the channel a task-status subscriber
 * is routed to.
 */
export const principalChannel = (
  principalType: PrincipalType,
  subject: string,
): string | null => {
  if (subject.length === 0) return null;
  if (principalType === 'user') return `user:${subject}`;
  return subject.startsWith('guest:') ? subject : null;
};

/**
 * Routes a raw Redis Pub/Sub message to the appropriate sockets by its envelope
 * scope, forwarding the browser-facing `{topic, payload}` (the server-side
 * `routes` are stripped). An `authenticated_global` message is broadcast to every
 * socket; any other scope is targeted to each of its `routes` (principal channels
 * by default, or per-tab channels for task types that opt in). The routes are
 * opaque here - the server does not re-derive or validate them (Superset builds
 * every key from an authorized identity and validates policy-supplied keys before
 * publishing).
 */
export const routeRedisMessage = (
  channel: string,
  rawMessage: string,
): void => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMessage);
  } catch (err) {
    logger.error(`Failed to parse message on channel ${channel}: ${err}`);
    return;
  }
  const envelope = parseRealtimeEnvelope(parsed);
  if (!envelope) {
    logger.error(`Invalid realtime envelope on channel ${channel}`);
    return;
  }
  const outbound: OutboundMessage = {
    topic: envelope.topic,
    payload: envelope.payload,
  };
  if (envelope.scope === SCOPE_AUTHENTICATED_GLOBAL) {
    broadcastToAll(outbound);
    return;
  }
  // Targeted (principal/tab) scope: deliver to each named route once.
  const sent = new Set<string>();
  (envelope.routes ?? []).forEach(route => {
    if (sent.has(route)) return;
    sent.add(route);
    sendToChannel(route, outbound);
  });
};

/**
 * Subscribes the Redis connection to the single realtime channel
 * (`REALTIME_CHANNEL`, i.e. `<REALTIME_CHANNEL_PREFIX>realtime`) that carries
 * every browser-bound message (broadcast and targeted, distinguished by each
 * envelope's scope).
 *
 * Pub/Sub is best-effort and not replayable, so there is no server-side catch-up:
 * a message published while a socket was away is simply gone. The browser recovers
 * by reconciling through the authorized REST API — a ``status_changes`` catch-up on
 * (re)connect and a last-chance read before giving up — not an interval poll.
 *
 * Failure to subscribe at all is observable and self-healing rather than silent:
 * if the initial ``subscribe`` rejects (e.g. Redis unreachable at startup) it is
 * logged and retried, so the transport can't end up running with no
 * subscription. ioredis additionally re-establishes the subscription
 * automatically across reconnects once it exists.
 */
let messageBound = false;

export const subscribeToChannels = async (): Promise<void> => {
  // Bind the router exactly once; retries must not stack duplicate listeners
  // (which would route every message N times).
  if (!messageBound) {
    redisSubscriber.on('message', (channel: string, message: string) => {
      routeRedisMessage(channel, message);
    });
    messageBound = true;
  }
  try {
    await redisSubscriber.subscribe(REALTIME_CHANNEL);
    markSubscriberHealthy();
    logger.info(`Subscribed to Redis channel: ${REALTIME_CHANNEL}`);
  } catch (err) {
    logger.error(
      `Failed to subscribe to Redis channel; retrying in ` +
        `${SUBSCRIBE_RETRY_MS}ms: ${err}`,
    );
    setTimeout(subscribeToChannels, SUBSCRIBE_RETRY_MS);
  }
};

// After a reconnect ioredis re-subscribes automatically; reconfirm the
// subscription (idempotent) so the healthy flag flips back on. Wired here, after
// subscribeToChannels is defined, to avoid a use-before-define reference.
redisSubscriber.on('ready', () => {
  subscribeToChannels();
});

/**
 * Verify and parse a realtime JWT cookie from an HTTP request.
 */
const verifyRealtimeJwt = (token: string): RealtimeJwtPayload => {
  let lastError: unknown;
  const acceptedSecrets = [opts.jwtSecret, opts.previousJwtSecret].filter(
    secret => secret.length > 0,
  );

  for (const secret of acceptedSecrets) {
    try {
      return jwt.verify(token, secret, {
        algorithms: opts.jwtAlgorithms as Algorithm[],
        audience: REALTIME_JWT_AUDIENCE,
        complete: false,
        issuer: REALTIME_JWT_ISSUER,
      }) as RealtimeJwtPayload;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('JWT verification failed');
};

/**
 * Verify a realtime JWT cookie on an HTTP request and extract the socket
 * identity it proves. Throws when the token is absent, unverifiable, or its
 * claims do not describe a routable principal.
 */
export const readSocketIdentity = (
  request: http.IncomingMessage,
): SocketIdentity => {
  const cookies = parseCookie(request.headers.cookie || '');
  const token = cookies[opts.jwtCookieName];

  if (!token) throw new Error('JWT not present');
  const jwtPayload = verifyRealtimeJwt(token);
  const channelId = jwtPayload.channel;
  const subject = jwtPayload.sub;
  const principalType = jwtPayload.principal_type;
  const expiresAtSeconds = jwtPayload.exp;

  if (typeof channelId !== 'string' || channelId.length === 0) {
    throw new Error('Channel ID not present in JWT');
  }
  if (typeof subject !== 'string' || subject.length === 0) {
    throw new Error('Subject not present in JWT');
  }
  if (!isPrincipalType(principalType)) {
    throw new Error('Principal type not present in JWT');
  }
  if (channelId !== principalChannel(principalType, subject)) {
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
    principalType,
    subject,
    tokenExpiresAtMs,
  };
};

/**
 * WebSocket `connection` event handler. `identity` is the one already verified
 * during the HTTP upgrade (see `httpUpgrade`), so each connection's JWT is
 * verified exactly once.
 */
export const wsConnection = (
  ws: WebSocket,
  identity: SocketIdentity,
  tabId?: string,
) => {
  const { channel } = identity;

  // Refuse the connection if a configured connection limit has been reached,
  // before tracking it against the internal registries. The cap is keyed on the
  // principal channel (which counts all of a principal's tabs); the per-tab
  // channel is a delivery refinement and is not separately limit-checked.
  const limitReason = connectionLimitReason(channel);
  if (limitReason) {
    statsd.increment('ws_connection_rejected');
    logger.warn(`Refusing connection on channel ${channel}: ${limitReason}`);
    ws.close(CONNECTION_LIMIT_CLOSE_CODE, limitReason);
    return;
  }

  // When the browser advertised a tab id at connect, also register the socket
  // under a per-tab channel derived from its authorized principal channel
  // (`<channel>:<tabId>`). The tab id is client-supplied but always prefixed by
  // the authorized principal channel, so it can never address another
  // principal's sockets. Task-status can then target one tab, while the
  // principal channel still reaches all of a principal's tabs.
  const tabChannel = tabId ? `${channel}:${tabId}` : undefined;

  const socketInstance: SocketInstance = {
    ws,
    channel,
    tabChannel,
    identity,
    pongTs: Date.now(),
  };

  // Register once (mints a single socket id), then also index that same id under
  // the per-tab channel - never call trackClient twice (it would mint a second
  // id and a duplicate registry entry).
  const socketId = trackClient(channel, socketInstance);
  if (tabChannel) {
    (channels[tabChannel] ??= { sockets: [] }).sockets.push(socketId);
  }
  logger.debug(
    `socket ${socketId} connected on channel ${channel}` +
      (tabChannel ? ` (tab channel ${tabChannel})` : ''),
  );

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
    // Liveness: the process is up. Deliberately independent of subscriber health
    // (see /ready) so a transient Redis blip doesn't get the pod restarted.
    response.writeHead(200);
    response.end('OK');
  } else if (url.pathname === '/ready' && ['GET', 'HEAD'].includes(method)) {
    // Readiness: healthy only while the Redis subscriber is connected+subscribed,
    // so a load balancer can drain a pod whose transport is degraded (upgrade
    // refusal + socket close still cover correctness on their own).
    if (subscriberHealthy) {
      response.writeHead(200);
      response.end('OK');
    } else {
      response.writeHead(503);
      response.end('SUBSCRIBER_UNAVAILABLE');
    }
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

  // Refuse upgrades while the Redis subscriber is unhealthy: a socket accepted now
  // would silently miss messages until the subscription recovers. Reply 503 so the
  // client backs off and retries (its reconnect then runs the status_changes
  // catch-up against a healthy server).
  if (!subscriberHealthy) {
    statsd.increment('ws_upgrade_rejected');
    logger.warn('Rejecting WebSocket upgrade: Redis subscriber unhealthy');
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }

  let identity: SocketIdentity;
  try {
    identity = readSocketIdentity(request);
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

  // Optional per-tab id advertised on the connect URL (`?tab_id=<id>`), used to
  // also bind the socket to a per-tab channel for targeted task-status delivery.
  // Parsed from the request URL (mirrors httpRequest); absent/blank/invalid ->
  // no per-tab channel (principal-grain delivery, as before).
  let tabId: string | undefined;
  try {
    const parsed = new URL(
      request.url ?? '',
      `http://${request.headers.host ?? 'localhost'}`,
    ).searchParams.get('tab_id');
    if (parsed && isValidTabId(parsed)) tabId = parsed;
  } catch {
    // Malformed URL: ignore the tab hint and fall back to principal-grain.
  }

  wss.handleUpgrade(request, socket, head, function cb(ws: WebSocket) {
    wss.emit('connection', ws, request);
    wsConnection(ws, identity, tabId);
  });
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

    if (now >= socketInstance.identity.tokenExpiresAtMs) {
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
    } else if (!isSocketActive(socketId)) {
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
    channels[channel]?.sockets.filter(socketId => isSocketActive(socketId)) ||
    [];

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

  wss.on('connection', function (ws: WebSocket) {
    ws.on('error', (err: Error) =>
      logger.error(`socket error: ${err.message}`),
    );
  });
  httpServer.on('request', httpRequest);
  httpServer.on('upgrade', httpUpgrade);
  httpServer.listen(opts.port);
  logger.info(`Server started on port ${opts.port}`);

  subscribeToChannels();

  setInterval(checkSockets, opts.pingSocketsIntervalMs);
  setInterval(function gc() {
    for (const channel in channels) {
      cleanChannel(channel);
    }
  }, opts.gcChannelsIntervalMs);
}

// test utilities

export const resetState = () => {
  channels = {};
  sockets = {};
  messageBound = false;
  // A reset server is a clean, running (subscribed) server, so tests start from a
  // healthy transport; a test drives the unhealthy edge with markSubscriberUnhealthy.
  subscriberHealthy = true;
};
