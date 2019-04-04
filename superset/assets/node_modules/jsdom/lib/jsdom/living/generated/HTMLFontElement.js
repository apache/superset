"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLFontElement() {
  throw new TypeError("Illegal constructor");
}
HTMLFontElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLFontElement.prototype.constructor = HTMLFontElement;


HTMLFontElement.prototype.toString = function () {
  if (this === HTMLFontElement.prototype) {
    return "[object HTMLFontElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLFontElement.prototype, "color", {
  get() {
    const value = this.getAttribute("color");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("color", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFontElement.prototype, "face", {
  get() {
    const value = this.getAttribute("face");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("face", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFontElement.prototype, "size", {
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
    let obj = Object.create(HTMLFontElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLFontElement.prototype);
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
  interface: HTMLFontElement,
  expose: {
    Window: { HTMLFontElement: HTMLFontElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLFontElement-impl.js");
