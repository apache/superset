"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLTableCellElement() {
  throw new TypeError("Illegal constructor");
}
HTMLTableCellElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLTableCellElement.prototype.constructor = HTMLTableCellElement;


HTMLTableCellElement.prototype.toString = function () {
  if (this === HTMLTableCellElement.prototype) {
    return "[object HTMLTableCellElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLTableCellElement.prototype, "colSpan", {
  get() {
    return this[impl].colSpan;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].colSpan = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "rowSpan", {
  get() {
    return this[impl].rowSpan;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].rowSpan = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "headers", {
  get() {
    return utils.tryWrapperForImpl(this[impl].headers);
  },
  set(V) {
    this.headers.value = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "cellIndex", {
  get() {
    return this[impl].cellIndex;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "align", {
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

Object.defineProperty(HTMLTableCellElement.prototype, "axis", {
  get() {
    const value = this.getAttribute("axis");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("axis", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "height", {
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

Object.defineProperty(HTMLTableCellElement.prototype, "width", {
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

Object.defineProperty(HTMLTableCellElement.prototype, "ch", {
  get() {
    const value = this.getAttribute("char");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("char", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "chOff", {
  get() {
    const value = this.getAttribute("charoff");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("charoff", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "noWrap", {
  get() {
    return this.hasAttribute("noWrap");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("noWrap", "");
  } else {
    this.removeAttribute("noWrap");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "vAlign", {
  get() {
    const value = this.getAttribute("vAlign");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("vAlign", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableCellElement.prototype, "bgColor", {
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
    let obj = Object.create(HTMLTableCellElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableCellElement.prototype);
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
  interface: HTMLTableCellElement,
  expose: {
    Window: { HTMLTableCellElement: HTMLTableCellElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLTableCellElement-impl.js");
