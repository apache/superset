const config = require('./config.json');
const http = require('http');
const WebSocket = require('ws');
const Redis = require('ioredis');
const redis = new Redis(config.redis);

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

let channels = {};
let lastFirehoseId = '$';
let redisRequestCount = 0;

const firehoseStream = 'fullstream';

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
3. Publish events to two streams, one global and one user-specific [SELECTED].
  Single blocking connection (XREAD) to continuously ready new events on the global stream.
  Load data from user-specific streams (XRANGE) only upon reconnection to fetch any missed events.
*/

function sendToChannel(channel, value) {
  const strData = JSON.stringify(value);
  if(!channels[channel]) {
    console.log(`channel ${channel} is unknown, skipping`);
    return;
  }
  channels[channel].sockets.forEach(ws => {
    ws.send(strData);
    channels[channel].lastId = value[0];
  });
  console.log(`${strData} sent to ${channel} with lastId ${channels[channel].lastId}`);
}

async function fetchRangeFromStream({channel, startId, endId, listener}) {
  console.log('fetchRangeFromStream', channel, startId, endId);
  try {
    const reply = await redis.xrange(channel, startId, endId);
    console.log('*** fetchRangeFromStream reply', reply);
    if (!reply || !reply.length) return;
    listener(reply);
  } catch(e) {
    console.error(e);
  }
}

async function subscribeToStream(stream, listener) {
  console.log(`subscribeToStream`, stream, listener);

  while (true) {
    try {
      console.log('*** lastFirehoseId', lastFirehoseId);
      const reply = await redis.xread('BLOCK', '5000', 'COUNT', 100, 'STREAMS', stream, lastFirehoseId);
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

function processStreamResults(results) {
  console.log('process results', results);
  results.forEach((item) => {
    const data = JSON.parse(item[1][1]);
    console.log('data', data);
    sendToChannel(data['channel_id'], data);
  });
}


wss.on('connection', function connection(ws, request) {
  if(!ws.channel) return false; // TODO: close socket?

  if(ws.channel in channels) {
    channels[ws.channel].sockets.push(ws)
  } else {
    channels[ws.channel] = {sockets: [ws]};
  }

  console.log('ws.lastId', ws.lastId);
  if(ws.lastId) {
    const endId = (lastFirehoseId === '$' ? '+' : lastFirehoseId);
    fetchRangeFromStream({
      channel: ws.channel,
      startId: ws.lastId,   // TODO: inclusive?
      endId,                // TODO: inclusive?
      listener: processStreamResults
    });
  }
  
  ws.on('message', function message(msg) {
    console.log(`Received message ${msg} on channel ${ws.channel}`);
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

subscribeToStream(firehoseStream, processStreamResults);

server.listen(8080);
console.log('websocket server started on 8080');

setInterval(() => {
  console.log('total connected sockets', wss.clients.size);
  console.log('redis request count', redisRequestCount);
}, 1000)