"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLBRElement() {
  throw new TypeError("Illegal constructor");
}
HTMLBRElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLBRElement.prototype.constructor = HTMLBRElement;


HTMLBRElement.prototype.toString = function () {
  if (this === HTMLBRElement.prototype) {
    return "[object HTMLBRElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLBRElement.prototype, "clear", {
  get() {
    const value = this.getAttribute("clear");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("clear", V);
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
    let obj = Object.create(HTMLBRElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLBRElement.prototype);
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
  interface: HTMLBRElement,
  expose: {
    Window: { HTMLBRElement: HTMLBRElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLBRElement-impl.js");
