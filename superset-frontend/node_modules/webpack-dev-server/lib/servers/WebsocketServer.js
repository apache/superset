'use strict';

/* eslint-disable
  class-methods-use-this
*/
const ws = require('ws');
const BaseServer = require('./BaseServer');

module.exports = class WebsocketServer extends BaseServer {
  constructor(server) {
    super(server);
    this.wsServer = new ws.Server({
      noServer: true,
      path: this.server.sockPath,
    });

    this.server.listeningApp.on('upgrade', (req, sock, head) => {
      if (!this.wsServer.shouldHandle(req)) {
        return;
      }

      this.wsServer.handleUpgrade(req, sock, head, (connection) => {
        this.wsServer.emit('connection', connection, req);
      });
    });

    this.wsServer.on('error', (err) => {
      this.server.log.error(err.message);
    });

    const noop = () => {};

    setInterval(() => {
      this.wsServer.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping(noop);
      });
    }, this.server.heartbeatInterval);
  }

  send(connection, message) {
    // prevent cases where the server is trying to send data while connection is closing
    if (connection.readyState !== 1) {
      return;
    }

    connection.send(message);
  }

  close(connection) {
    connection.close();
  }

  // f should be passed the resulting connection and the connection headers
  onConnection(f) {
    this.wsServer.on('connection', (connection, req) => {
      connection.isAlive = true;
      connection.on('pong', () => {
        connection.isAlive = true;
      });
      f(connection, req.headers);
    });
  }

  onConnectionClose(connection, f) {
    connection.on('close', f);
  }
};
