console.log('hello');
let socketCount = 0;
let messageCount = 0;

const jwtSecret = "test-secret-change-me";

function ts() {
    return (new Date()).getTime();
}

const tokenData = document.getElementById('tokens').innerHTML;
const tokens = JSON.parse(tokenData);
console.log('tokens', tokens);

function connect() {
    if(socketCount >= tokens.length) return;

    // using https://github.com/js-cookie/js-cookie
    Cookies.set('async-token', tokens[socketCount], { expires: 1, path: '' });

    // Create WebSocket connection.
    let url = `ws://127.0.0.1:8080?last_id=${ts()}`;
    const socket = new WebSocket(url);

    // Connection opened
    socket.addEventListener('open', function (event) {
        socketCount++;
        console.log(`socket count ${socketCount}`);
        connect();

        socket.send('Hello Server!');
    });

    // Listen for messages
    socket.addEventListener('message', function (event) {
        console.log('Message from server', event.data);
        messageCount++;
        console.log(`message count ${messageCount}`);
    });
}

connect();
