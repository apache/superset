"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLFrameElement() {
  throw new TypeError("Illegal constructor");
}
HTMLFrameElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLFrameElement.prototype.constructor = HTMLFrameElement;


HTMLFrameElement.prototype.toString = function () {
  if (this === HTMLFrameElement.prototype) {
    return "[object HTMLFrameElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLFrameElement.prototype, "name", {
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

Object.defineProperty(HTMLFrameElement.prototype, "scrolling", {
  get() {
    const value = this.getAttribute("scrolling");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("scrolling", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "src", {
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

Object.defineProperty(HTMLFrameElement.prototype, "frameBorder", {
  get() {
    const value = this.getAttribute("frameBorder");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("frameBorder", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "longDesc", {
  get() {
    return this[impl].longDesc;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].longDesc = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "noResize", {
  get() {
    return this.hasAttribute("noResize");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("noResize", "");
  } else {
    this.removeAttribute("noResize");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "contentDocument", {
  get() {
    return utils.tryWrapperForImpl(this[impl].contentDocument);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "contentWindow", {
  get() {
    return utils.tryWrapperForImpl(this[impl].contentWindow);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "marginHeight", {
  get() {
    const value = this.getAttribute("marginHeight");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("marginHeight", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFrameElement.prototype, "marginWidth", {
  get() {
    const value = this.getAttribute("marginWidth");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("marginWidth", V);
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
    let obj = Object.create(HTMLFrameElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLFrameElement.prototype);
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
  interface: HTMLFrameElement,
  expose: {
    Window: { HTMLFrameElement: HTMLFrameElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLFrameElement-impl.js");
