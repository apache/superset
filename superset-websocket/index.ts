import * as http from 'http';
import * as net from 'net';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const Redis = require('ioredis');

export type StreamResult = [recordId: string, record: [label: 'data', data: string]];
type ListenerFunction = (results: StreamResult[]) => void;
interface EventValue {
  id: string,
  channel_id: string,
  job_id: string,
  user_id?: string,
  status: string,
  errors?: Array<any>,  // TODO
  result_url?: string,
}
interface JwtPayload { channel: string };
interface FetchRangeFromStreamParams { sessionId: string, startId: string, endId: string, listener: ListenerFunction }
export interface SocketInstance { ws: WebSocket, channel: string, pongTs: number };

interface ChannelValue {
  sockets: Array<string>,
}

const environment = process.env.NODE_ENV;
export const opts = {
  port: 8080,
  redis: {
    port: 6379,
    host: "127.0.0.1",
    password: "",
    db: 0
  },
  streamPrefix: "async-events-",
  jwtSecret: "",
  jwtCookieName: "async-token",
  redisStreamReadCount: 100,
  redisStreamReadBlockMs: 5000,
  socketResponseTimeoutMs: 60 * 1000,
  pingSocketsIntervalMs: 20 * 1000,
  gcChannelsIntervalMs: 120 * 1000,
}

const startServer = process.argv[2] === 'start';
const configFile = environment === 'test' ? './config.test.json' : './config.json';
let config = {};
try {
  config = require(configFile);
} catch(err) {
  console.warn('config.json not found, using defaults');
}

Object.assign(opts, config);

if(startServer && opts.jwtSecret.length < 32)
  throw('Please provide a JWT secret at least 32 bytes long')

const redis = new Redis(opts.redis);
const httpServer = http.createServer();
export const wss = new WebSocket.Server({ noServer: true, clientTracking: false });

const SOCKET_ACTIVE_STATES = [WebSocket.OPEN, WebSocket.CONNECTING];
const GLOBAL_EVENT_STREAM_NAME: string = `${opts.streamPrefix}full`;
const DEFAULT_STREAM_LAST_ID = '$';

export let channels: Record<string, ChannelValue> = {};
export let sockets: Record<string, SocketInstance> = {};
let lastFirehoseId: string = DEFAULT_STREAM_LAST_ID;


export const setLastFirehostId = (id: string): void => {
  lastFirehoseId = id;
}

export const trackClient = (channel: string, socketInstance: SocketInstance): string => {
  const socketId = uuidv4();
  sockets[socketId] = socketInstance;

  if(channel in channels) {
    channels[channel].sockets.push(socketId)
  } else {
    channels[channel] = {sockets: [socketId]};
  }

  return socketId;
}

export const sendToChannel = (channel: string, value: EventValue): void => {
  const strData = JSON.stringify(value);
  if(!channels[channel]) {
    console.debug(`channel ${channel} is unknown, skipping`);
    return;
  }
  channels[channel].sockets.forEach(socketId => {
    const socketInstance: SocketInstance = sockets[socketId];
    if(!socketInstance) return cleanChannel(channel);
    try {
      socketInstance.ws.send(strData);
    } catch(err) {
      console.debug('Error sending to socket', err);
      cleanChannel(channel);
    }
  });
}

export const fetchRangeFromStream = async ({sessionId, startId, endId, listener}: FetchRangeFromStreamParams) => {
  const streamName = `${opts.streamPrefix}${sessionId}`;
  try {
    const reply = await redis.xrange(streamName, startId, endId);
    if (!reply || !reply.length) return;
    listener(reply);
  } catch(e) {
    console.error(e);
  }
}

export const subscribeToGlobalStream = async (stream: string, listener: ListenerFunction) => {
  while (true) {
    try {
      const reply = await redis.xread(
        'BLOCK',
        opts.redisStreamReadBlockMs,
        'COUNT',
        opts.redisStreamReadCount,
        'STREAMS',
        stream,
        lastFirehoseId
      );
      if (!reply) {
        continue
      }
      const results = reply[0][1];
      const {length} = results;
      if (!results.length) {
        continue
      }
      listener(results)
      setLastFirehostId(results[length - 1][0])
    } catch(e) {
      console.error(e);
      continue
    }
  }
}

export const processStreamResults = (results: StreamResult[]): void => {
  console.debug('events received', results);
  results.forEach((item) => {
    try {
      const id = item[0];
      const data = JSON.parse(item[1][1]);
      sendToChannel(data.channel_id, {id, ...data});
    } catch(err) {
      console.error(err);
    }
  });
}

const getJwtPayload = (request: http.IncomingMessage): JwtPayload => {
  const cookies = cookie.parse(request.headers.cookie);
  const token = cookies[opts.jwtCookieName];

  if(!token) throw new Error('JWT not present');
  return jwt.verify(token, opts.jwtSecret);
}

const getLastId = (request: http.IncomingMessage): string | null => {
  const url = new URL(String(request.url), 'http://0.0.0.0');
  const queryParams = url.searchParams;
  return queryParams.get('last_id');
}

export const wsConnection = (ws: WebSocket, request: http.IncomingMessage) => {
  const jwtPayload: JwtPayload = getJwtPayload(request);
  const channel: string = jwtPayload.channel;
  const socketInstance: SocketInstance = { ws, channel, pongTs: Date.now() }

  const socketId = trackClient(channel, socketInstance);
  console.debug(`socket ${socketId} connected on channel ${channel}`);

  const lastId = getLastId(request);
  if(lastId) {
    const endId = (lastFirehoseId === DEFAULT_STREAM_LAST_ID ? '+' : lastFirehoseId);
    fetchRangeFromStream({
      sessionId: channel,
      startId: lastId,   // TODO: inclusive?
      endId,                // TODO: inclusive?
      listener: processStreamResults
    });
  }

  ws.on('pong', function pong(data: Buffer) {
    const socketId = data.toString();
    console.debug('pong', socketId);
    const socketInstance = sockets[socketId];
    if (!socketInstance) {
      console.warn(`pong received for nonexistent socket ${socketId}`);
    } else {
      socketInstance.pongTs = Date.now();
    }
  });
}

export const httpUpgrade = (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  try {
    const jwtPayload: JwtPayload = getJwtPayload(request);
    if(!jwtPayload.channel) throw new Error('Channel ID not present');
  } catch(err) {
    console.error(err);
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, function cb(ws: WebSocket, request: http.IncomingMessage) {
    wss.emit('connection', ws, request);
  });
}


// Connection cleanup and garbage collection

export const checkSockets = () => {
  console.debug('*** socket count', Object.keys(sockets).length);
  for (const socketId in sockets) {
    const socketInstance = sockets[socketId];
    const timeout = Date.now() - socketInstance.pongTs;
    let isActive = true;

    if(timeout >= opts.socketResponseTimeoutMs) {
      console.debug(`terminating unresponsive socket: ${socketId}, channel: ${socketInstance.channel}`);
      socketInstance.ws.terminate();
      isActive = false;
    } else if (!SOCKET_ACTIVE_STATES.includes(socketInstance.ws.readyState)) {
      isActive = false;
    }

    if(isActive) {
      console.debug(`ping ${socketId}`);
      socketInstance.ws.ping(socketId);
    } else {
      delete sockets[socketId];
      console.debug(`forgetting socket ${socketId}`);
    }
  }
}

export const cleanChannel = (channel: string) => {
  const activeSockets: string[] = channels[channel]?.sockets.filter(socketId => {
    const socketInstance = sockets[socketId];
    if (!socketInstance) return false;
    if (SOCKET_ACTIVE_STATES.includes(socketInstance.ws.readyState)) return true;
    return false;
  }) || [];

  if(activeSockets.length === 0) {
    delete channels[channel];
  } else {
    channels[channel].sockets = activeSockets;
  }
}


// server startup

if(startServer) {
  wss.on('connection', wsConnection);
  httpServer.on('upgrade', httpUpgrade);
  httpServer.listen(opts.port);
  console.info(`Server started on port ${opts.port}`);

  // start reading from event stream
  subscribeToGlobalStream(GLOBAL_EVENT_STREAM_NAME, processStreamResults);

  // init garbage collection
  const checkSocketsInterval = setInterval(checkSockets, opts.pingSocketsIntervalMs);
  const cleanChannelInterval = setInterval(function gc() {
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
}
