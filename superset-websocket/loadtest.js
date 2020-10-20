const config = require('./config.json');
const Redis = require('ioredis');
const redis = new Redis(config.redis);

const numClients = 256;
const globalEventStreamName = `${config.streamPrefix}full`;

function pushData() {
    for (let i=0; i < numClients; i++) {

        const streamId = `${config.streamPrefix}${i}`;
        const data = {
            session_id: i,  // uuidv4 IRL
            user_id: i,
            query_id: `query ID here`
        }

        // push to specific userId-prefixed stream
        // TODO: limit max stream size
        redis.xadd(streamId, '*', 'data', JSON.stringify(data)).then(resp => {
            console.log('stream response', resp);
        });

        // push to firehose (all events) stream
        redis.xadd(globalEventStreamName, '*', 'data', JSON.stringify(data)).then(resp => {
            console.log('stream response', resp);
        });

    }
}

pushData();
setInterval(pushData, 1000);


// process.exit();
