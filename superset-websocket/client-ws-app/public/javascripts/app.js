console.log('hello');
let socketCount = 0;
let messageCount = 0;

for (let i=0; i < 100; i++) {
    // Create WebSocket connection.
    const socket = new WebSocket(`ws://localhost:8080?channel=stream${i}`);

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
