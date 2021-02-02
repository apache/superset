import * as http from 'http';
import * as net from 'net';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const config = require('./config.json');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const Redis = require('ioredis');

type StreamResult = [recordId: string, record: [label: 'data', data: string]];
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
interface SocketInstance { ws: WebSocket, channel: string, pongTs: number };

interface ChannelValue {
  sockets: Array<string>,
}

const opts = {
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
  socketResponseTimeoutMs: 30 * 1000,
  debug: false,
}

Object.assign(opts, config);

if(opts.jwtSecret.length < 32)
  throw('Please provide a JWT secret at least 32 bytes long')

const redis = new Redis(opts.redis);
const httpServer = http.createServer();
const wss = new WebSocket.Server({ noServer: true, clientTracking: false });

const socketActiveStates = [WebSocket.OPEN, WebSocket.CONNECTING];
const globalEventStreamName: string = `${opts.streamPrefix}full`;
let channels: Record<string, ChannelValue> = {};
let sockets: Record<string, SocketInstance> = {};
let lastFirehoseId: string = '$';
let redisRequestCount: number = 0;

function sendToChannel(channel: string, value: EventValue): void {
  const strData = JSON.stringify(value);
  if(!channels[channel]) {
    console.log(`channel ${channel} is unknown, skipping`);
    return;
  }
  channels[channel].sockets.forEach(socketId => {
    const socketInstance: SocketInstance = sockets[socketId];
    try {
      socketInstance.ws.send(strData);
    } catch(err) {
      console.log('Error sending to socket', err);
      cleanChannel(channel);
    }
  });
}

async function fetchRangeFromStream({sessionId, startId, endId, listener}: FetchRangeFromStreamParams) {
  const streamName = `${opts.streamPrefix}${sessionId}`;
  try {
    const reply = await redis.xrange(streamName, startId, endId);
    if (!reply || !reply.length) return;
    listener(reply);
  } catch(e) {
    console.error(e);
  }
}

async function subscribeToGlobalStream(stream: string, listener: ListenerFunction) {
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
      lastFirehoseId = results[length - 1][0]
    } catch(e) {
      console.error(e);
      continue
    }
  }
}

function processStreamResults(results: StreamResult[]): void {
  results.forEach((item) => {
    try {
      const id = item[0];
      const data = JSON.parse(item[1][1]);
      console.log('data', data);
      sendToChannel(data.channel_id, {id, ...data});
    } catch(err) {
      console.log(err);
    }
  });
}

function getJwtPayload(request: http.IncomingMessage): JwtPayload {
  const cookies = cookie.parse(request.headers.cookie);
  const token = cookies[opts.jwtCookieName];

  if(!token) throw new Error('JWT not present');
  return jwt.verify(token, opts.jwtSecret);
}

function getLastId(request: http.IncomingMessage): string | null {
  const url = new URL(String(request.url), 'http://0.0.0.0');
  const queryParams = url.searchParams;
  return queryParams.get('last_id');
}

wss.on('connection', function connection(ws: WebSocket, request: http.IncomingMessage) {
  const jwtPayload: JwtPayload = getJwtPayload(request);
  const channel: string = jwtPayload.channel;
  const instance: SocketInstance = { ws, channel, pongTs: Date.now() }

  const socketId = uuidv4();
  sockets[socketId] = instance;

  if(channel in channels) {
    channels[channel].sockets.push(socketId)
  } else {
    channels[channel] = {sockets: [socketId]};
  }

  const lastId = getLastId(request);
  if(lastId) {
    const endId = (lastFirehoseId === '$' ? '+' : lastFirehoseId);
    fetchRangeFromStream({
      sessionId: channel,
      startId: lastId,   // TODO: inclusive?
      endId,                // TODO: inclusive?
      listener: processStreamResults
    });
  }

  ws.on('pong', function pong(data: Buffer) {
    const socketId = data.toString();
    console.log('pong', socketId);
    const socketInstance = sockets[socketId];
    if (!socketInstance) {
      console.warn(`pong received for nonexistent socket ${socketId}`);
    } else {
      socketInstance.pongTs = Date.now();
    }
  });
});

httpServer.on('upgrade', function upgrade(request: http.IncomingMessage, socket: net.Socket, head: Buffer) {
  try {
    const jwtPayload: JwtPayload = getJwtPayload(request);
    if(!jwtPayload.channel) throw new Error('Channel ID not present');
  } catch(err) {
    console.log(err);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, function cb(ws: WebSocket, request: http.IncomingMessage) {
    wss.emit('connection', ws, request);
  });
});

httpServer.listen(opts.port);
console.log(`Server started on port ${opts.port}`);

subscribeToGlobalStream(globalEventStreamName, processStreamResults);

// Connection cleanup and garbage collection

const checkSockets = () => {
  console.log('*** checkSockets', Object.keys(sockets).length);
  for (const socketId in sockets) {
    const socketInstance = sockets[socketId];
    const timeout = Date.now() - socketInstance.pongTs;
    if(timeout > opts.socketResponseTimeoutMs) {
      console.log(`terminating socket ${socketId} for channel ${socketInstance.channel}`);
      socketInstance.ws.terminate();
      delete sockets[socketId];
    } else {
      socketInstance.ws.ping(socketId);
    }
  }
}

const cleanChannel = (channel: string) => {
  const activeSockets: string[] = channels[channel].sockets.filter(socketId => {
    const socketInstance = sockets[socketId];
    if (!socketInstance) return false;
    if (socketActiveStates.includes(socketInstance.ws.readyState)) return true;
    return false;
  });

  if(activeSockets.length === 0) {
    delete channels[channel];
  } else {
    channels[channel].sockets = activeSockets;
  }
}

const checkSocketsInterval = setInterval(checkSockets, 5000);
const cleanChannelInterval = setInterval(function gc() {
  for (const channel in channels) {
    cleanChannel(channel);
  }
}, 60000);

// if(opts.debug) {
//   setInterval(() => {
//     console.log('total connected sockets', wss.clients.size);
//     console.log('redis request count', redisRequestCount);
//   }, 2000)
// }
