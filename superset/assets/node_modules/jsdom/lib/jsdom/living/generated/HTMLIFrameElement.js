"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLIFrameElement() {
  throw new TypeError("Illegal constructor");
}
HTMLIFrameElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLIFrameElement.prototype.constructor = HTMLIFrameElement;


HTMLIFrameElement.prototype.getSVGDocument = function getSVGDocument() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].getSVGDocument.apply(this[impl], args));
};

HTMLIFrameElement.prototype.toString = function () {
  if (this === HTMLIFrameElement.prototype) {
    return "[object HTMLIFrameElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLIFrameElement.prototype, "src", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "srcdoc", {
  get() {
    const value = this.getAttribute("srcdoc");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("srcdoc", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLIFrameElement.prototype, "name", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "seamless", {
  get() {
    return this[impl].seamless;
  },
  set(V) {
    V = conversions["boolean"](V);
    this[impl].seamless = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLIFrameElement.prototype, "allowFullscreen", {
  get() {
    return this.hasAttribute("allowFullscreen");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("allowFullscreen", "");
  } else {
    this.removeAttribute("allowFullscreen");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLIFrameElement.prototype, "width", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "height", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "contentDocument", {
  get() {
    return utils.tryWrapperForImpl(this[impl].contentDocument);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
  get() {
    return utils.tryWrapperForImpl(this[impl].contentWindow);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLIFrameElement.prototype, "align", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "scrolling", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "frameBorder", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "longDesc", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "marginHeight", {
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

Object.defineProperty(HTMLIFrameElement.prototype, "marginWidth", {
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
    let obj = Object.create(HTMLIFrameElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLIFrameElement.prototype);
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
  interface: HTMLIFrameElement,
  expose: {
    Window: { HTMLIFrameElement: HTMLIFrameElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLIFrameElement-impl.js");
