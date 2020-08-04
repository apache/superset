"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const WindowEventHandlers = require("./WindowEventHandlers.js");

function HTMLFrameSetElement() {
  throw new TypeError("Illegal constructor");
}
HTMLFrameSetElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLFrameSetElement.prototype.constructor = HTMLFrameSetElement;

mixin(HTMLFrameSetElement.prototype, WindowEventHandlers.interface.prototype);
WindowEventHandlers.mixedInto.push(HTMLFrameSetElement);

HTMLFrameSetElement.prototype.toString = function () {
  if (this === HTMLFrameSetElement.prototype) {
    return "[object HTMLFrameSetElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLFrameSetElement.prototype, "cols", {
  get() {
    const value = this.getAttribute("cols");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("cols", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameSetElement.prototype, "rows", {
  get() {
    const value = this.getAttribute("rows");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("rows", V);
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
    let obj = Object.create(HTMLFrameSetElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLFrameSetElement.prototype);
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
  interface: HTMLFrameSetElement,
  expose: {
    Window: { HTMLFrameSetElement: HTMLFrameSetElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLFrameSetElement-impl.js");
