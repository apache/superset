import * as http from 'http';
import * as net from 'net';
import WebSocket from 'ws';

const config = require('./config.json');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const Redis = require('ioredis');

type StreamResult = [recordId: string, record: [label: 'data', data: string]];
type ListenerFunction = (results: StreamResult[]) => void;
interface EventValue {
  channel_id: string,
  job_id: string,
  user_id?: string,
  status: string,
  errors?: Array<any>,  // TODO
  result_url?: string,
}
interface JwtPayload { channel: string };
interface FetchRangeFromStreamParams { sessionId: string, startId: string, endId: string, listener: ListenerFunction }

interface ChannelValue {
  sockets: Array<any>,  // TODO
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
  debug: false,
}

Object.assign(opts, config);

if(opts.jwtSecret.length < 32)
  throw('Please provide a JWT secret at least 32 bytes long')

const redis = new Redis(opts.redis);
const httpServer = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

const globalEventStreamName: string = `${opts.streamPrefix}full`;
let channels: Record<string, ChannelValue> = {};
let lastFirehoseId: string = '$';
let redisRequestCount: number = 0;

function sendToChannel(channel: string, value: EventValue): void {
  console.log('*** sendToChannel', channel, value);
  const strData = JSON.stringify(value);
  if(!channels[channel]) {
    console.log(`channel ${channel} is unknown, skipping`);
    return;
  }
  channels[channel].sockets.forEach(ws => {
    ws.send(strData);
  });
  console.log(`${strData} sent to ${channel}`);
}

async function fetchRangeFromStream({sessionId, startId, endId, listener}: FetchRangeFromStreamParams) {
  console.log('fetchRangeFromStream', sessionId, startId, endId);
  const streamName = `${opts.streamPrefix}${sessionId}`;
  try {
    const reply = await redis.xrange(streamName, startId, endId);
    console.log('*** fetchRangeFromStream reply', reply);
    if (!reply || !reply.length) return;
    listener(reply);
  } catch(e) {
    console.error(e);
  }
}

async function subscribeToGlobalStream(stream: string, listener: ListenerFunction) {
  console.log(`subscribeToGlobalStream`, stream, listener);

  while (true) {
    try {
      console.log('*** lastFirehoseId', lastFirehoseId);
      const reply = await redis.xread(
        'BLOCK',
        opts.redisStreamReadBlockMs,
        'COUNT',
        opts.redisStreamReadCount,
        'STREAMS',
        stream,
        lastFirehoseId
      );
      console.log('*** firehose reply', reply);
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
  console.log('process results', results);
  results.forEach((item) => {
    try {
      const data = JSON.parse(item[1][1]);
      console.log('data', data);
      sendToChannel(data.channel_id, data);
    } catch(err) {
      console.log(err);
    }
  });
}

function getJwtPayload(request: http.IncomingMessage): JwtPayload {
  const cookies = cookie.parse(request.headers.cookie);
  const token = cookies[opts.jwtCookieName];
  console.log('cookies', cookies, token);

  if(!token) throw new Error('JWT not present');
  return jwt.verify(token, opts.jwtSecret);
}

function getLastId(request: http.IncomingMessage): string | null {
  const url = new URL(String(request.url), 'http://0.0.0.0');
  const queryParams = url.searchParams;
  console.log('queryParams', queryParams);
  return queryParams.get('last_id');
}

wss.on('connection', function connection(ws: WebSocket, request: http.IncomingMessage) {
  const jwtPayload: JwtPayload = getJwtPayload(request);
  const channel: string = jwtPayload.channel;

  if(channel in channels) {
    channels[channel].sockets.push(ws)
  } else {
    channels[channel] = {sockets: [ws]};
  }

  const lastId = getLastId(request);
  console.log('lastId', lastId);

  if(lastId) {
    const endId = (lastFirehoseId === '$' ? '+' : lastFirehoseId);
    fetchRangeFromStream({
      sessionId: channel,
      startId: lastId,   // TODO: inclusive?
      endId,                // TODO: inclusive?
      listener: processStreamResults
    });
  }

  // ws.on('message', function message(msg: string) {
  //   console.log(`Received message ${msg} on channel ${ws.channel}`);
  //   sendToChannel(ws.channel, { msg: `received message on channel ${ws.channel}`});
  // });
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

if(opts.debug) {
  setInterval(() => {
    console.log('total connected sockets', wss.clients.size);
    console.log('redis request count', redisRequestCount);
  }, 2000)
}

subscribeToGlobalStream(globalEventStreamName, processStreamResults);
