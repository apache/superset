"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function NavigatorLanguage() {
  throw new TypeError("Illegal constructor");
}


NavigatorLanguage.prototype.toString = function () {
  if (this === NavigatorLanguage.prototype) {
    return "[object NavigatorLanguagePrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(NavigatorLanguage.prototype, "language", {
  get() {
    return this[impl].language;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(NavigatorLanguage.prototype, "languages", {
  get() {
    return utils.tryWrapperForImpl(this[impl].languages);
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
    let obj = Object.create(NavigatorLanguage.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(NavigatorLanguage.prototype);
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
  interface: NavigatorLanguage,
  expose: {
    
  }
};
module.exports = iface;

const Impl = require("../navigator/NavigatorLanguage-impl.js");
