const config = require('./config.json');
const Redis = require('ioredis');
const redis = new Redis(config.redis);

for (let i=0; i < 100; i++) {
    const streamId = `stream${i}`;
    redis.xadd(streamId, '*', 'msg', `data for stream ${streamId}`).then(resp => {
        console.log('stream response', resp);
    });   
}

// process.exit();