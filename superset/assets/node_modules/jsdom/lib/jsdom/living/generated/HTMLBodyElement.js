"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const WindowEventHandlers = require("./WindowEventHandlers.js");

function HTMLBodyElement() {
  throw new TypeError("Illegal constructor");
}
HTMLBodyElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLBodyElement.prototype.constructor = HTMLBodyElement;

mixin(HTMLBodyElement.prototype, WindowEventHandlers.interface.prototype);
WindowEventHandlers.mixedInto.push(HTMLBodyElement);

HTMLBodyElement.prototype.toString = function () {
  if (this === HTMLBodyElement.prototype) {
    return "[object HTMLBodyElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLBodyElement.prototype, "text", {
  get() {
    const value = this.getAttribute("text");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("text", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLBodyElement.prototype, "link", {
  get() {
    const value = this.getAttribute("link");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("link", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLBodyElement.prototype, "vLink", {
  get() {
    const value = this.getAttribute("vLink");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("vLink", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLBodyElement.prototype, "aLink", {
  get() {
    const value = this.getAttribute("aLink");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("aLink", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLBodyElement.prototype, "bgColor", {
  get() {
    const value = this.getAttribute("bgColor");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("bgColor", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLBodyElement.prototype, "background", {
  get() {
    const value = this.getAttribute("background");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("background", V);
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
    let obj = Object.create(HTMLBodyElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLBodyElement.prototype);
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
  interface: HTMLBodyElement,
  expose: {
    Window: { HTMLBodyElement: HTMLBodyElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLBodyElement-impl.js");
