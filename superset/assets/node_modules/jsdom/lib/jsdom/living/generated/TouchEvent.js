"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const UIEvent = require("./UIEvent.js");
const impl = utils.implSymbol;

function TouchEvent() {
  throw new TypeError("Illegal constructor");
}
TouchEvent.prototype = Object.create(UIEvent.interface.prototype);
TouchEvent.prototype.constructor = TouchEvent;


TouchEvent.prototype.toString = function () {
  if (this === TouchEvent.prototype) {
    return "[object TouchEventPrototype]";
  }
  return UIEvent.interface.prototype.toString.call(this);
};
Object.defineProperty(TouchEvent.prototype, "touches", {
  get() {
    return utils.tryWrapperForImpl(this[impl].touches);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "targetTouches", {
  get() {
    return utils.tryWrapperForImpl(this[impl].targetTouches);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "changedTouches", {
  get() {
    return utils.tryWrapperForImpl(this[impl].changedTouches);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "altKey", {
  get() {
    return this[impl].altKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "metaKey", {
  get() {
    return this[impl].metaKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "ctrlKey", {
  get() {
    return this[impl].ctrlKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(TouchEvent.prototype, "shiftKey", {
  get() {
    return this[impl].shiftKey;
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
    let obj = Object.create(TouchEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(TouchEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    UIEvent._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: TouchEvent,
  expose: {
    Window: { TouchEvent: TouchEvent }
  }
};
module.exports = iface;

const Impl = require("../events/TouchEvent-impl.js");
