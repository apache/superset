"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLDListElement() {
  throw new TypeError("Illegal constructor");
}
HTMLDListElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLDListElement.prototype.constructor = HTMLDListElement;


HTMLDListElement.prototype.toString = function () {
  if (this === HTMLDListElement.prototype) {
    return "[object HTMLDListElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLDListElement.prototype, "compact", {
  get() {
    return this.hasAttribute("compact");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("compact", "");
  } else {
    this.removeAttribute("compact");
  }
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
    let obj = Object.create(HTMLDListElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLDListElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLElement._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: HTMLDListElement,
  expose: {
    Window: { HTMLDListElement: HTMLDListElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLDListElement-impl.js");
