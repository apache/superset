"use strict";

const EventImpl = require("./Event-impl").implementation;

class MessageEventImpl extends EventImpl {
  initMessageEvent(type, bubbles, cancelable, data, origin, lastEventId, source, ports) {
    if (this._dispatchFlag) {
      return;
    }

    this.initEvent(type, bubbles, cancelable);
    this.data = data;
    this.origin = origin;
    this.lastEventId = lastEventId;
    this.source = source;
    this.ports = ports;
  }
}

module.exports = {
  implementation: MessageEventImpl
};
