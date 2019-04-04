"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLObjectElement() {
  throw new TypeError("Illegal constructor");
}
HTMLObjectElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLObjectElement.prototype.constructor = HTMLObjectElement;


HTMLObjectElement.prototype.toString = function () {
  if (this === HTMLObjectElement.prototype) {
    return "[object HTMLObjectElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLObjectElement.prototype, "data", {
  get() {
    return this[impl].data;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].data = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "type", {
  get() {
    const value = this.getAttribute("type");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("type", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "name", {
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

Object.defineProperty(HTMLObjectElement.prototype, "useMap", {
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

Object.defineProperty(HTMLObjectElement.prototype, "form", {
  get() {
    return utils.tryWrapperForImpl(this[impl].form);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "width", {
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

Object.defineProperty(HTMLObjectElement.prototype, "height", {
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

Object.defineProperty(HTMLObjectElement.prototype, "contentDocument", {
  get() {
    return utils.tryWrapperForImpl(this[impl].contentDocument);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "align", {
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

Object.defineProperty(HTMLObjectElement.prototype, "archive", {
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

Object.defineProperty(HTMLObjectElement.prototype, "code", {
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

Object.defineProperty(HTMLObjectElement.prototype, "declare", {
  get() {
    return this.hasAttribute("declare");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("declare", "");
  } else {
    this.removeAttribute("declare");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "hspace", {
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

Object.defineProperty(HTMLObjectElement.prototype, "standby", {
  get() {
    const value = this.getAttribute("standby");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("standby", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "vspace", {
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

Object.defineProperty(HTMLObjectElement.prototype, "codeBase", {
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

Object.defineProperty(HTMLObjectElement.prototype, "codeType", {
  get() {
    const value = this.getAttribute("codeType");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("codeType", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLObjectElement.prototype, "border", {
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
    let obj = Object.create(HTMLObjectElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLObjectElement.prototype);
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
  interface: HTMLObjectElement,
  expose: {
    Window: { HTMLObjectElement: HTMLObjectElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLObjectElement-impl.js");
