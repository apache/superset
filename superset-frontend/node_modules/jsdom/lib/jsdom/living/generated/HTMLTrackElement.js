"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLTrackElement() {
  throw new TypeError("Illegal constructor");
}
HTMLTrackElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLTrackElement.prototype.constructor = HTMLTrackElement;


HTMLTrackElement.prototype.toString = function () {
  if (this === HTMLTrackElement.prototype) {
    return "[object HTMLTrackElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLTrackElement.prototype, "kind", {
  get() {
    const value = this.getAttribute("kind");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("kind", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTrackElement.prototype, "src", {
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

Object.defineProperty(HTMLTrackElement.prototype, "srclang", {
  get() {
    const value = this.getAttribute("srclang");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("srclang", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTrackElement.prototype, "label", {
  get() {
    const value = this.getAttribute("label");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("label", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTrackElement.prototype, "default", {
  get() {
    return this.hasAttribute("default");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("default", "");
  } else {
    this.removeAttribute("default");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTrackElement, "NONE", {
  value: 0,
  enumerable: true
});
Object.defineProperty(HTMLTrackElement.prototype, "NONE", {
  value: 0,
  enumerable: true
});

Object.defineProperty(HTMLTrackElement, "LOADING", {
  value: 1,
  enumerable: true
});
Object.defineProperty(HTMLTrackElement.prototype, "LOADING", {
  value: 1,
  enumerable: true
});

Object.defineProperty(HTMLTrackElement, "LOADED", {
  value: 2,
  enumerable: true
});
Object.defineProperty(HTMLTrackElement.prototype, "LOADED", {
  value: 2,
  enumerable: true
});

Object.defineProperty(HTMLTrackElement, "ERROR", {
  value: 3,
  enumerable: true
});
Object.defineProperty(HTMLTrackElement.prototype, "ERROR", {
  value: 3,
  enumerable: true
});

Object.defineProperty(HTMLTrackElement.prototype, "readyState", {
  get() {
    return this[impl].readyState;
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
    let obj = Object.create(HTMLTrackElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTrackElement.prototype);
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
  interface: HTMLTrackElement,
  expose: {
    Window: { HTMLTrackElement: HTMLTrackElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLTrackElement-impl.js");
