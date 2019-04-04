"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLOListElement() {
  throw new TypeError("Illegal constructor");
}
HTMLOListElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLOListElement.prototype.constructor = HTMLOListElement;


HTMLOListElement.prototype.toString = function () {
  if (this === HTMLOListElement.prototype) {
    return "[object HTMLOListElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLOListElement.prototype, "reversed", {
  get() {
    return this.hasAttribute("reversed");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("reversed", "");
  } else {
    this.removeAttribute("reversed");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOListElement.prototype, "start", {
  get() {
    const value = parseInt(this.getAttribute("start"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["long"](V);
    this.setAttribute("start", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOListElement.prototype, "type", {
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

Object.defineProperty(HTMLOListElement.prototype, "compact", {
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
    let obj = Object.create(HTMLOListElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLOListElement.prototype);
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
  interface: HTMLOListElement,
  expose: {
    Window: { HTMLOListElement: HTMLOListElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLOListElement-impl.js");
