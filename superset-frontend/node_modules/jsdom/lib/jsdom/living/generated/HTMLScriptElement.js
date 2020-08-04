"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLScriptElement() {
  throw new TypeError("Illegal constructor");
}
HTMLScriptElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLScriptElement.prototype.constructor = HTMLScriptElement;


HTMLScriptElement.prototype.toString = function () {
  if (this === HTMLScriptElement.prototype) {
    return "[object HTMLScriptElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLScriptElement.prototype, "src", {
  get() {
    return this[impl].src;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].src = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLScriptElement.prototype, "type", {
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

Object.defineProperty(HTMLScriptElement.prototype, "charset", {
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

Object.defineProperty(HTMLScriptElement.prototype, "defer", {
  get() {
    return this.hasAttribute("defer");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("defer", "");
  } else {
    this.removeAttribute("defer");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLScriptElement.prototype, "crossOrigin", {
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

Object.defineProperty(HTMLScriptElement.prototype, "text", {
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

Object.defineProperty(HTMLScriptElement.prototype, "nonce", {
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

Object.defineProperty(HTMLScriptElement.prototype, "event", {
  get() {
    const value = this.getAttribute("event");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("event", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLScriptElement.prototype, "htmlFor", {
  get() {
    const value = this.getAttribute("for");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("for", V);
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
    let obj = Object.create(HTMLScriptElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLScriptElement.prototype);
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
  interface: HTMLScriptElement,
  expose: {
    Window: { HTMLScriptElement: HTMLScriptElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLScriptElement-impl.js");
