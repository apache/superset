const config = require('./config.json');
const Redis = require('ioredis');
const redis = new Redis(config.redis);

const numClients = 100;

function pushData() {
    for (let i=0; i < numClients; i++) {
        const channelPrefix = 'c';
        const channelId = `${channelPrefix}${i}`;
        const data = {
            channel_id: channelId,
            query_id: `query ID here`
        }
    
        // push to specific userId-prefixed stream
        // TODO: limit max stream size
        redis.xadd(channelId, '*', 'data', JSON.stringify(data)).then(resp => {
            console.log('stream response', resp);
        });
    
        // push to firehose (all events) stream
        redis.xadd('fullstream', '*', 'data', JSON.stringify(data)).then(resp => {
            console.log('stream response', resp);
        });
    
    }
}

pushData();
setInterval(pushData, 1000);


// process.exit();