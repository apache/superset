const _ = require('lodash');
const config = require('./config.json');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
const redis = new Redis(config.redis);

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

let channels = {};
let redisRequestCount = 0;

/* 
NOT using Redis Stream consumer groups due to the fact that they only read
a subset of the data for a stream, and Websocket clients have a persistent
connection to each app instance, requiring access to all data in a stream.
Horizontal scaling of the websocket app means having multiple websocket servers,
each with full access to the Redis Stream.
*/
//const appId = 'app01';  // NOTE: this value should be unique for all running instances of the app

/*
Stream options:

1. Stream for each Superset installation (including all horizontal nodes)
  Pros:
    - single (blocking?) connection to Redis
  Cons:
    - retrieving records for a single user on reconnection will be inefficient
2. Stream for each Superset user
  Pros:
    - retrieving records for a single user on reconnection will be namespaced
    - reading only from streams for users connected to this wss server instance
  Cons:
    - multiple (blocking?) connections to Redis
      - could read multiple streams using the same blocking connection
    - Users could be connected to multiple wss server instances in different browser tabs
*/

function ts() {
  return (new Date()).getTime();
}

function incrementId(id) {
  // id format: <timestamp-ms>-<sequence-number>, e.g. '1586141297082-0'
  let prefixTs, seq;
  [prefixTs, seq] = String(id).split('-');
  if(seq === undefined) return id;
  return prefixTs + '-' + (parseInt(seq, 10) + 1);
}

function sendToChannel(channel, value) {
  channels[channel].sockets.forEach(ws => {
    ws.send(JSON.stringify(value));
    channels[channel].lastId = value[0];
  });
  console.log(`${value} sent to ${channel} with lastId ${channels[channel].lastId}`);
}

function loadDataFromStream(channel, startId) {
  // console.log('loadDataFromStream', startId);
  redis.xrange(channel, startId, '+').then(resp => {
    if(_.isEmpty(resp)) return;
    console.log('stream response', resp);
    if(_.isArray(resp)) {
      resp.forEach((item) => sendToChannel(channel, item));
    }
  }).finally(() => {
    const lastId = channels[channel].lastId || startId;
    const nextId = incrementId(lastId);   // XRANGE ids are inclusive
    redisRequestCount++;
    // console.log(`loaded ${lastId}, nextId ${nextId}`);
    loadDataFromStream(channel, nextId);
  });
}

wss.on('connection', function connection(ws, request) {
  if(!ws.channel) return false; // TODO: close socket?

  if(ws.channel in channels) {
    channels[ws.channel].sockets.push(ws)
  } else {
    channels[ws.channel] = {sockets: [ws]};
    const startId = ws.lastId || ts();
    loadDataFromStream(ws.channel, startId);
  }
  
  ws.on('message', function message(msg) {
    console.log(`Received message ${msg} on channel ${ws.channel}`);
    // channels[ws.channel].send('test server');
  });
});

server.on('upgrade', function upgrade(request, socket, head) {
    // console.log('request.headers', request.headers);
    const url = new URL(request.url, 'http://0.0.0.0');
    const queryParams = url.searchParams;
    console.log('queryParams', queryParams);
    const channel = queryParams.get('channel'); // TODO: parse User ID from channel name for auth check
    const lastId = queryParams.get('last_id'); // TODO: parse User ID from channel name for auth check
    const lastEventId = queryParams.get('last_event_id');
    
//   authenticate(request, (err, client) => {
//     if (err || !client) {
//       socket.destroy();
//       return;
//     }

    wss.handleUpgrade(request, socket, head, function done(ws) {
      ws.channel = channel;
      ws.lastId = lastId;
      wss.emit('connection', ws, request);
    });
//   });
});

server.listen(8080);
console.log('websocket server started on 8080');

setInterval(() => {
  console.log('total connected sockets', wss.clients.size);
  console.log('redis request count', redisRequestCount);
}, 1000)