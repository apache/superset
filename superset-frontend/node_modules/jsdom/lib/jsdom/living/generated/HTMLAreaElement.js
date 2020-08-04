"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const HTMLHyperlinkElementUtils = require("./HTMLHyperlinkElementUtils.js");

function HTMLAreaElement() {
  throw new TypeError("Illegal constructor");
}
HTMLAreaElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLAreaElement.prototype.constructor = HTMLAreaElement;

mixin(HTMLAreaElement.prototype, HTMLHyperlinkElementUtils.interface.prototype);
HTMLHyperlinkElementUtils.mixedInto.push(HTMLAreaElement);

HTMLAreaElement.prototype.toString = function () {
  if (this === HTMLAreaElement.prototype) {
    return "[object HTMLAreaElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLAreaElement.prototype, "alt", {
  get() {
    const value = this.getAttribute("alt");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("alt", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAreaElement.prototype, "coords", {
  get() {
    const value = this.getAttribute("coords");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("coords", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAreaElement.prototype, "shape", {
  get() {
    const value = this.getAttribute("shape");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("shape", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAreaElement.prototype, "target", {
  get() {
    const value = this.getAttribute("target");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("target", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAreaElement.prototype, "rel", {
  get() {
    const value = this.getAttribute("rel");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("rel", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAreaElement.prototype, "noHref", {
  get() {
    return this.hasAttribute("noHref");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("noHref", "");
  } else {
    this.removeAttribute("noHref");
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
    let obj = Object.create(HTMLAreaElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLAreaElement.prototype);
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
  interface: HTMLAreaElement,
  expose: {
    Window: { HTMLAreaElement: HTMLAreaElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLAreaElement-impl.js");
