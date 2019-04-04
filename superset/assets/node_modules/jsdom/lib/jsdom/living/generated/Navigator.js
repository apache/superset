"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const NavigatorID = require("./NavigatorID.js");
const NavigatorLanguage = require("./NavigatorLanguage.js");
const NavigatorOnLine = require("./NavigatorOnLine.js");
const NavigatorCookies = require("./NavigatorCookies.js");
const NavigatorPlugins = require("./NavigatorPlugins.js");
const NavigatorConcurrentHardware = require("./NavigatorConcurrentHardware.js");

function Navigator() {
  throw new TypeError("Illegal constructor");
}

mixin(Navigator.prototype, NavigatorID.interface.prototype);
NavigatorID.mixedInto.push(Navigator);
mixin(Navigator.prototype, NavigatorLanguage.interface.prototype);
NavigatorLanguage.mixedInto.push(Navigator);
mixin(Navigator.prototype, NavigatorOnLine.interface.prototype);
NavigatorOnLine.mixedInto.push(Navigator);
mixin(Navigator.prototype, NavigatorCookies.interface.prototype);
NavigatorCookies.mixedInto.push(Navigator);
mixin(Navigator.prototype, NavigatorPlugins.interface.prototype);
NavigatorPlugins.mixedInto.push(Navigator);
mixin(Navigator.prototype, NavigatorConcurrentHardware.interface.prototype);
NavigatorConcurrentHardware.mixedInto.push(Navigator);

Navigator.prototype.toString = function () {
  if (this === Navigator.prototype) {
    return "[object NavigatorPrototype]";
  }
  return this[impl].toString();
};

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
    let obj = Object.create(Navigator.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Navigator.prototype);
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
  interface: Navigator,
  expose: {
    Window: { Navigator: Navigator }
  }
};
module.exports = iface;

const Impl = require("../navigator/Navigator-impl.js");
