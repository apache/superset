"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLAppletElement() {
  throw new TypeError("Illegal constructor");
}
HTMLAppletElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLAppletElement.prototype.constructor = HTMLAppletElement;


HTMLAppletElement.prototype.toString = function () {
  if (this === HTMLAppletElement.prototype) {
    return "[object HTMLAppletElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLAppletElement.prototype, "align", {
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

Object.defineProperty(HTMLAppletElement.prototype, "alt", {
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

Object.defineProperty(HTMLAppletElement.prototype, "archive", {
  get() {
    const value = this.getAttribute("archive");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("archive", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "code", {
  get() {
    const value = this.getAttribute("code");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("code", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "codeBase", {
  get() {
    return this[impl].codeBase;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].codeBase = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "height", {
  get() {
    const value = this.getAttribute("height");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("height", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "hspace", {
  get() {
    const value = parseInt(this.getAttribute("hspace"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["unsigned long"](V);
    V = V > 2147483647 ? 0 : V;
    this.setAttribute("hspace", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "name", {
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

Object.defineProperty(HTMLAppletElement.prototype, "object", {
  get() {
    return this[impl].object;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].object = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "vspace", {
  get() {
    const value = parseInt(this.getAttribute("vspace"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["unsigned long"](V);
    V = V > 2147483647 ? 0 : V;
    this.setAttribute("vspace", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLAppletElement.prototype, "width", {
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
    let obj = Object.create(HTMLAppletElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLAppletElement.prototype);
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
  interface: HTMLAppletElement,
  expose: {
    Window: { HTMLAppletElement: HTMLAppletElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLAppletElement-impl.js");
