"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLMediaElement = require("./HTMLMediaElement.js");
const impl = utils.implSymbol;

function HTMLAudioElement() {
  throw new TypeError("Illegal constructor");
}
HTMLAudioElement.prototype = Object.create(HTMLMediaElement.interface.prototype);
HTMLAudioElement.prototype.constructor = HTMLAudioElement;


HTMLAudioElement.prototype.toString = function () {
  if (this === HTMLAudioElement.prototype) {
    return "[object HTMLAudioElementPrototype]";
  }
  return HTMLMediaElement.interface.prototype.toString.call(this);
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
    let obj = Object.create(HTMLAudioElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLAudioElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLMediaElement._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: HTMLAudioElement,
  expose: {
    Window: { HTMLAudioElement: HTMLAudioElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLAudioElement-impl.js");
