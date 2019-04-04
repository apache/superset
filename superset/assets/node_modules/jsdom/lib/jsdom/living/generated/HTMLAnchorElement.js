"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const HTMLHyperlinkElementUtils = require("./HTMLHyperlinkElementUtils.js");

function HTMLAnchorElement() {
  throw new TypeError("Illegal constructor");
}
HTMLAnchorElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLAnchorElement.prototype.constructor = HTMLAnchorElement;

mixin(HTMLAnchorElement.prototype, HTMLHyperlinkElementUtils.interface.prototype);
HTMLHyperlinkElementUtils.mixedInto.push(HTMLAnchorElement);

HTMLAnchorElement.prototype.toString = function () {
  if (this === HTMLAnchorElement.prototype) {
    return "[object HTMLAnchorElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLAnchorElement.prototype, "target", {
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

Object.defineProperty(HTMLAnchorElement.prototype, "download", {
  get() {
    const value = this.getAttribute("download");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("download", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "rel", {
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

Object.defineProperty(HTMLAnchorElement.prototype, "hreflang", {
  get() {
    const value = this.getAttribute("hreflang");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("hreflang", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "type", {
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

Object.defineProperty(HTMLAnchorElement.prototype, "text", {
  get() {
    return this[impl].text;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].text = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "coords", {
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

Object.defineProperty(HTMLAnchorElement.prototype, "charset", {
  get() {
    const value = this.getAttribute("charset");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("charset", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "name", {
  get() {
    const value = this.getAttribute("name");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("name", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "rev", {
  get() {
    const value = this.getAttribute("rev");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("rev", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAnchorElement.prototype, "shape", {
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
    let obj = Object.create(HTMLAnchorElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLAnchorElement.prototype);
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
  interface: HTMLAnchorElement,
  expose: {
    Window: { HTMLAnchorElement: HTMLAnchorElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLAnchorElement-impl.js");
