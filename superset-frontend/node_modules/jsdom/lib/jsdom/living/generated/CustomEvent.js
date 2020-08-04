"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Event = require("./Event.js");
const impl = utils.implSymbol;
const convertCustomEventInit = require("./CustomEventInit").convert;

function CustomEvent(type) {
  if (!this || this[impl] || !(this instanceof CustomEvent)) {
    throw new TypeError("Failed to construct 'CustomEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'CustomEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertCustomEventInit(args[1]);

  iface.setup(this, args);
}
CustomEvent.prototype = Object.create(Event.interface.prototype);
CustomEvent.prototype.constructor = CustomEvent;


CustomEvent.prototype.initCustomEvent = function initCustomEvent(type, bubbles, cancelable, detail) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 4) {
    throw new TypeError("Failed to execute 'initCustomEvent' on 'CustomEvent': 4 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 4; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  args[3] = conversions["any"](args[3]);
  return this[impl].initCustomEvent.apply(this[impl], args);
};

CustomEvent.prototype.toString = function () {
  if (this === CustomEvent.prototype) {
    return "[object CustomEventPrototype]";
  }
  return Event.interface.prototype.toString.call(this);
};
Object.defineProperty(CustomEvent.prototype, "detail", {
  get() {
    return this[impl].detail;
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
    let obj = Object.create(CustomEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(CustomEvent.prototype);
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
  interface: CustomEvent,
  expose: {
    Window: { CustomEvent: CustomEvent },
    Worker: { CustomEvent: CustomEvent }
  }
};
module.exports = iface;

const Impl = require("../events/CustomEvent-impl.js");
