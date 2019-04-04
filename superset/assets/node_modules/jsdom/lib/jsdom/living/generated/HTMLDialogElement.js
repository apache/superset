"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLDialogElement() {
  throw new TypeError("Illegal constructor");
}
HTMLDialogElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLDialogElement.prototype.constructor = HTMLDialogElement;


HTMLDialogElement.prototype.toString = function () {
  if (this === HTMLDialogElement.prototype) {
    return "[object HTMLDialogElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  get() {
    return this.hasAttribute("open");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("open", "");
  } else {
    this.removeAttribute("open");
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
    let obj = Object.create(HTMLDialogElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLDialogElement.prototype);
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
  interface: HTMLDialogElement,
  expose: {
    Window: { HTMLDialogElement: HTMLDialogElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLDialogElement-impl.js");
