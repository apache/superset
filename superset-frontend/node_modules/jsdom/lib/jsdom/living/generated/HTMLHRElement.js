"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLHRElement() {
  throw new TypeError("Illegal constructor");
}
HTMLHRElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLHRElement.prototype.constructor = HTMLHRElement;


HTMLHRElement.prototype.toString = function () {
  if (this === HTMLHRElement.prototype) {
    return "[object HTMLHRElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLHRElement.prototype, "align", {
  get() {
    const value = this.getAttribute("align");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("align", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLHRElement.prototype, "color", {
  get() {
    const value = this.getAttribute("color");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("color", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLHRElement.prototype, "noShade", {
  get() {
    return this.hasAttribute("noShade");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("noShade", "");
  } else {
    this.removeAttribute("noShade");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLHRElement.prototype, "size", {
  get() {
    const value = this.getAttribute("size");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("size", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLHRElement.prototype, "width", {
  get() {
    const value = this.getAttribute("width");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("width", V);
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
    let obj = Object.create(HTMLHRElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLHRElement.prototype);
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
  interface: HTMLHRElement,
  expose: {
    Window: { HTMLHRElement: HTMLHRElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLHRElement-impl.js");
