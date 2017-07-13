from __future__ import absolute_import

import tornado.websocket


class BaseWebSocketHandler(tornado.websocket.WebSocketHandler):
    # listeners = [], should be created in derived class

    def open(self):
        listeners = self.listeners
        listeners.append(self)

    def on_message(self, message):
        pass

    def on_close(self):
        listeners = self.listeners
        if self in listeners:
            listeners.remove(self)

    @classmethod
    def send_message(cls, message):
        for l in cls.listeners:
            l.write_message(message)
