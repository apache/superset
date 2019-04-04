"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function NavigatorConcurrentHardware() {
  throw new TypeError("Illegal constructor");
}


NavigatorConcurrentHardware.prototype.toString = function () {
  if (this === NavigatorConcurrentHardware.prototype) {
    return "[object NavigatorConcurrentHardwarePrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(NavigatorConcurrentHardware.prototype, "hardwareConcurrency", {
  get() {
    return this[impl].hardwareConcurrency;
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
    let obj = Object.create(NavigatorConcurrentHardware.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(NavigatorConcurrentHardware.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: NavigatorConcurrentHardware,
  expose: {
    
  }
};
module.exports = iface;

const Impl = require("../navigator/NavigatorConcurrentHardware-impl.js");
