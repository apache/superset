"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Event = require("./Event.js");
const impl = utils.implSymbol;
const convertHashChangeEventInit = require("./HashChangeEventInit").convert;

function HashChangeEvent(type) {
  if (!this || this[impl] || !(this instanceof HashChangeEvent)) {
    throw new TypeError("Failed to construct 'HashChangeEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'HashChangeEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertHashChangeEventInit(args[1]);

  iface.setup(this, args);
}
HashChangeEvent.prototype = Object.create(Event.interface.prototype);
HashChangeEvent.prototype.constructor = HashChangeEvent;


HashChangeEvent.prototype.toString = function () {
  if (this === HashChangeEvent.prototype) {
    return "[object HashChangeEventPrototype]";
  }
  return Event.interface.prototype.toString.call(this);
};
Object.defineProperty(HashChangeEvent.prototype, "oldURL", {
  get() {
    return this[impl].oldURL;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HashChangeEvent.prototype, "newURL", {
  get() {
    return this[impl].newURL;
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
    let obj = Object.create(HashChangeEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HashChangeEvent.prototype);
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
  interface: HashChangeEvent,
  expose: {
    Window: { HashChangeEvent: HashChangeEvent },
    Worker: { HashChangeEvent: HashChangeEvent }
  }
};
module.exports = iface;

const Impl = require("../events/HashChangeEvent-impl.js");
