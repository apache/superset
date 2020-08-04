"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const LinkStyle = require("./LinkStyle.js");

function HTMLLinkElement() {
  throw new TypeError("Illegal constructor");
}
HTMLLinkElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLLinkElement.prototype.constructor = HTMLLinkElement;

mixin(HTMLLinkElement.prototype, LinkStyle.interface.prototype);
LinkStyle.mixedInto.push(HTMLLinkElement);

HTMLLinkElement.prototype.toString = function () {
  if (this === HTMLLinkElement.prototype) {
    return "[object HTMLLinkElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLLinkElement.prototype, "href", {
  get() {
    return this[impl].href;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].href = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLLinkElement.prototype, "crossOrigin", {
  get() {
    const value = this.getAttribute("crossOrigin");
    return value === null ? "" : value;
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    V = conversions["DOMString"](V);
    }
    this.setAttribute("crossOrigin", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLLinkElement.prototype, "rel", {
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

Object.defineProperty(HTMLLinkElement.prototype, "media", {
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

Object.defineProperty(HTMLLinkElement.prototype, "hreflang", {
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

Object.defineProperty(HTMLLinkElement.prototype, "type", {
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

Object.defineProperty(HTMLLinkElement.prototype, "charset", {
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

Object.defineProperty(HTMLLinkElement.prototype, "rev", {
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

Object.defineProperty(HTMLLinkElement.prototype, "target", {
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
    let obj = Object.create(HTMLLinkElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLLinkElement.prototype);
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
  interface: HTMLLinkElement,
  expose: {
    Window: { HTMLLinkElement: HTMLLinkElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLLinkElement-impl.js");
