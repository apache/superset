console.log('hello');
let socketCount = 0;
let messageCount = 0;

const numClients = 100;

function ts() {
    return (new Date()).getTime();
}

for (let i=0; i < numClients; i++) {
    // Create WebSocket connection.
    const channelPrefix = 'c';
    const channelId = `${channelPrefix}${i}`;
    const lastIdReceived = ts();
    let url = `ws://localhost:8080?channel=${channelId}`;
    if(lastIdReceived) url += `&last_id=${lastIdReceived}`
    const socket = new WebSocket(url);

    // Connection opened
    socket.addEventListener('open', function (event) {
        socketCount++;
        console.log(`socket count ${socketCount}`);

        socket.send('Hello Server!');
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
        console.log('Message from server', event.data);
        messageCount++;
        console.log(`message count ${messageCount}`);
    });
};
