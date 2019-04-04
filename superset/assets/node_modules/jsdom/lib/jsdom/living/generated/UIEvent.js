"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Event = require("./Event.js");
const impl = utils.implSymbol;
const convertUIEventInit = require("./UIEventInit").convert;

function UIEvent(type) {
  if (!this || this[impl] || !(this instanceof UIEvent)) {
    throw new TypeError("Failed to construct 'UIEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'UIEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertUIEventInit(args[1]);

  iface.setup(this, args);
}
UIEvent.prototype = Object.create(Event.interface.prototype);
UIEvent.prototype.constructor = UIEvent;


UIEvent.prototype.initUIEvent = function initUIEvent(typeArg, bubblesArg, cancelableArg, viewArg, detailArg) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 5) {
    throw new TypeError("Failed to execute 'initUIEvent' on 'UIEvent': 5 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 5; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  if (args[3] === null || args[3] === undefined) {
    args[3] = null;
  } else {
  }
  args[4] = conversions["long"](args[4]);
  return this[impl].initUIEvent.apply(this[impl], args);
};

UIEvent.prototype.toString = function () {
  if (this === UIEvent.prototype) {
    return "[object UIEventPrototype]";
  }
  return Event.interface.prototype.toString.call(this);
};
Object.defineProperty(UIEvent.prototype, "view", {
  get() {
    return utils.tryWrapperForImpl(this[impl].view);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(UIEvent.prototype, "detail", {
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
    let obj = Object.create(UIEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(UIEvent.prototype);
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
  interface: UIEvent,
  expose: {
    Window: { UIEvent: UIEvent }
  }
};
module.exports = iface;

const Impl = require("../events/UIEvent-impl.js");
