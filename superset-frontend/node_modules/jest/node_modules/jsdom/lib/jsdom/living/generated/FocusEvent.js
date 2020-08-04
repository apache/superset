"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertFocusEventInit = require("./FocusEventInit.js").convert;
const impl = utils.implSymbol;
const UIEvent = require("./UIEvent.js");

class FocusEvent extends UIEvent.interface {
  constructor(type) {
    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to construct 'FocusEvent': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, { context: "Failed to construct 'FocusEvent': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = convertFocusEventInit(curArg, { context: "Failed to construct 'FocusEvent': parameter 2" });
      args.push(curArg);
    }
    return iface.setup(Object.create(new.target.prototype), args);
  }

  get relatedTarget() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["relatedTarget"]);
  }
}
Object.defineProperties(FocusEvent.prototype, {
  relatedTarget: { enumerable: true },
  [Symbol.toStringTag]: { value: "FocusEvent", configurable: true }
});
const iface = {
  // When an interface-module that implements this interface as a mixin is loaded, it will append its own `.is()`
  // method into this array. It allows objects that directly implements *those* interfaces to be recognized as
  // implementing this mixin interface.
  _mixedIntoPredicates: [],
  is(obj) {
    if (obj) {
      if (utils.hasOwn(obj, impl) && obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(obj)) {
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
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(wrapper)) {
          return true;
        }
      }
    }
    return false;
  },
  convert(obj, { context = "The provided value" } = {}) {
    if (module.exports.is(obj)) {
      return utils.implForWrapper(obj);
    }
    throw new TypeError(`${context} is not of type 'FocusEvent'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(FocusEvent.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(FocusEvent.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    UIEvent._internalSetup(obj);
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};

    privateData.wrapper = obj;

    this._internalSetup(obj);
    Object.defineProperty(obj, impl, {
      value: new Impl.implementation(constructorArgs, privateData),
      configurable: true
    });

    obj[impl][utils.wrapperSymbol] = obj;
    if (Impl.init) {
      Impl.init(obj[impl], privateData);
    }
    return obj;
  },
  interface: FocusEvent,
  expose: {
    Window: { FocusEvent }
  }
}; // iface
module.exports = iface;

const Impl = require("../events/FocusEvent-impl.js");
