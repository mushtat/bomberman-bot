var WebSocket = require('websocket').client,
    requestHandler = require('./requestHandler');
    path = require('./config').getPath(),
    client = new WebSocket();

function connect() {
    client.connect(path, 'echo-protocol');
}

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
    setTimeout(connect, 300);
});

client.on('connect', function(connection) {
    console.log('WebSocket client connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
        setTimeout(connect, 300);
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
        setTimeout(connect, 300);
    });
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            requestHandler(connection, message.utf8Data);
        }
    });
});

connect();