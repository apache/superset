"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const LinkStyle = require("./LinkStyle.js");

function HTMLStyleElement() {
  throw new TypeError("Illegal constructor");
}
HTMLStyleElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLStyleElement.prototype.constructor = HTMLStyleElement;

mixin(HTMLStyleElement.prototype, LinkStyle.interface.prototype);
LinkStyle.mixedInto.push(HTMLStyleElement);

HTMLStyleElement.prototype.toString = function () {
  if (this === HTMLStyleElement.prototype) {
    return "[object HTMLStyleElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLStyleElement.prototype, "media", {
  get() {
    const value = this.getAttribute("media");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("media", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLStyleElement.prototype, "nonce", {
  get() {
    const value = this.getAttribute("nonce");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("nonce", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLStyleElement.prototype, "type", {
  get() {
    const value = this.getAttribute("type");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("type", V);
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
    let obj = Object.create(HTMLStyleElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLStyleElement.prototype);
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
  interface: HTMLStyleElement,
  expose: {
    Window: { HTMLStyleElement: HTMLStyleElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLStyleElement-impl.js");
