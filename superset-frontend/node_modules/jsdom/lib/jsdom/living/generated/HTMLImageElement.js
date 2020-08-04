"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLImageElement() {
  throw new TypeError("Illegal constructor");
}
HTMLImageElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLImageElement.prototype.constructor = HTMLImageElement;


HTMLImageElement.prototype.toString = function () {
  if (this === HTMLImageElement.prototype) {
    return "[object HTMLImageElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLImageElement.prototype, "alt", {
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

Object.defineProperty(HTMLImageElement.prototype, "src", {
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

Object.defineProperty(HTMLImageElement.prototype, "srcset", {
  get() {
    const value = this.getAttribute("srcset");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("srcset", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "sizes", {
  get() {
    const value = this.getAttribute("sizes");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("sizes", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "crossOrigin", {
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

Object.defineProperty(HTMLImageElement.prototype, "useMap", {
  get() {
    const value = this.getAttribute("useMap");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("useMap", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "isMap", {
  get() {
    return this.hasAttribute("isMap");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("isMap", "");
  } else {
    this.removeAttribute("isMap");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "width", {
  get() {
    return this[impl].width;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].width = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "height", {
  get() {
    return this[impl].height;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].height = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
  get() {
    return this[impl].naturalWidth;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
  get() {
    return this[impl].naturalHeight;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "complete", {
  get() {
    return this[impl].complete;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "currentSrc", {
  get() {
    return this[impl].currentSrc;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "name", {
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

Object.defineProperty(HTMLImageElement.prototype, "lowsrc", {
  get() {
    const value = this.getAttribute("lowsrc");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("lowsrc", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "align", {
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

Object.defineProperty(HTMLImageElement.prototype, "hspace", {
  get() {
    const value = parseInt(this.getAttribute("hspace"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["long"](V);
    this.setAttribute("hspace", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "vspace", {
  get() {
    const value = parseInt(this.getAttribute("vspace"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["long"](V);
    this.setAttribute("vspace", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "longDesc", {
  get() {
    const value = this.getAttribute("longDesc");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("longDesc", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLImageElement.prototype, "border", {
  get() {
    const value = this.getAttribute("border");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("border", V);
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
    let obj = Object.create(HTMLImageElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLImageElement.prototype);
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
  interface: HTMLImageElement,
  expose: {
    Window: { HTMLImageElement: HTMLImageElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLImageElement-impl.js");
