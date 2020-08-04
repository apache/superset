"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Event = require("./Event.js");
const impl = utils.implSymbol;
const convertMessageEventInit = require("./MessageEventInit").convert;

function MessageEvent(type) {
  if (!this || this[impl] || !(this instanceof MessageEvent)) {
    throw new TypeError("Failed to construct 'MessageEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'MessageEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertMessageEventInit(args[1]);

  iface.setup(this, args);
}
MessageEvent.prototype = Object.create(Event.interface.prototype);
MessageEvent.prototype.constructor = MessageEvent;


MessageEvent.prototype.initMessageEvent = function initMessageEvent(type, bubbles, cancelable, data, origin, lastEventId, source, ports) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 8) {
    throw new TypeError("Failed to execute 'initMessageEvent' on 'MessageEvent': 8 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 8; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  args[3] = conversions["any"](args[3]);
  args[4] = conversions["DOMString"](args[4]);
  args[5] = conversions["DOMString"](args[5]);
  if (args[6] === null || args[6] === undefined) {
    args[6] = null;
  } else {
  }
  if (args[7] === null || args[7] === undefined) {
    args[7] = null;
  } else {
  }
  return this[impl].initMessageEvent.apply(this[impl], args);
};

MessageEvent.prototype.toString = function () {
  if (this === MessageEvent.prototype) {
    return "[object MessageEventPrototype]";
  }
  return Event.interface.prototype.toString.call(this);
};
Object.defineProperty(MessageEvent.prototype, "data", {
  get() {
    return this[impl].data;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MessageEvent.prototype, "origin", {
  get() {
    return this[impl].origin;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MessageEvent.prototype, "lastEventId", {
  get() {
    return this[impl].lastEventId;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MessageEvent.prototype, "source", {
  get() {
    return utils.tryWrapperForImpl(this[impl].source);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MessageEvent.prototype, "ports", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ports);
  },
  enumerable: true,
  configurable: true
});


const iface = {
  mixedInto: [],
  is(obj) {
    if (obj) {
      if (obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (obj instanceof module.exports.mixedInto[i]) {
          return true;
        }
      }
    }
    return false;
  },
  isImpl(obj) {
    if (obj) {
      if (obj instanceof Impl.implementation) {
        return true;
      }

      const wrapper = utils.wrapperForImpl(obj);
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (wrapper instanceof module.exports.mixedInto[i]) {
          return true;
        }
      }
    }
    return false;
  },
  create(constructorArgs, privateData) {
    let obj = Object.create(MessageEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(MessageEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Event._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: MessageEvent,
  expose: {
    Window: { MessageEvent: MessageEvent },
    Worker: { MessageEvent: MessageEvent }
  }
};
module.exports = iface;

const Impl = require("../events/MessageEvent-impl.js");
