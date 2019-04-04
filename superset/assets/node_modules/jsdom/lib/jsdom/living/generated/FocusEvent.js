"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const UIEvent = require("./UIEvent.js");
const impl = utils.implSymbol;
const convertFocusEventInit = require("./FocusEventInit").convert;

function FocusEvent(type) {
  if (!this || this[impl] || !(this instanceof FocusEvent)) {
    throw new TypeError("Failed to construct 'FocusEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'FocusEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertFocusEventInit(args[1]);

  iface.setup(this, args);
}
FocusEvent.prototype = Object.create(UIEvent.interface.prototype);
FocusEvent.prototype.constructor = FocusEvent;


FocusEvent.prototype.toString = function () {
  if (this === FocusEvent.prototype) {
    return "[object FocusEventPrototype]";
  }
  return UIEvent.interface.prototype.toString.call(this);
};
Object.defineProperty(FocusEvent.prototype, "relatedTarget", {
  get() {
    return utils.tryWrapperForImpl(this[impl].relatedTarget);
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
    let obj = Object.create(FocusEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(FocusEvent.prototype);
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
  interface: FocusEvent,
  expose: {
    Window: { FocusEvent: FocusEvent }
  }
};
module.exports = iface;

const Impl = require("../events/FocusEvent-impl.js");
