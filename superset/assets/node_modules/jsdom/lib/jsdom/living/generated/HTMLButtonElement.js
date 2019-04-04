"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLButtonElement() {
  throw new TypeError("Illegal constructor");
}
HTMLButtonElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLButtonElement.prototype.constructor = HTMLButtonElement;


HTMLButtonElement.prototype.toString = function () {
  if (this === HTMLButtonElement.prototype) {
    return "[object HTMLButtonElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLButtonElement.prototype, "autofocus", {
  get() {
    return this.hasAttribute("autofocus");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("autofocus", "");
  } else {
    this.removeAttribute("autofocus");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "disabled", {
  get() {
    return this.hasAttribute("disabled");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("disabled", "");
  } else {
    this.removeAttribute("disabled");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "form", {
  get() {
    return utils.tryWrapperForImpl(this[impl].form);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "formNoValidate", {
  get() {
    return this.hasAttribute("formNoValidate");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("formNoValidate", "");
  } else {
    this.removeAttribute("formNoValidate");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "formTarget", {
  get() {
    const value = this.getAttribute("formTarget");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("formTarget", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "name", {
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

Object.defineProperty(HTMLButtonElement.prototype, "type", {
  get() {
    return this[impl].type;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].type = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLButtonElement.prototype, "value", {
  get() {
    const value = this.getAttribute("value");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("value", V);
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
    let obj = Object.create(HTMLButtonElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLButtonElement.prototype);
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
  interface: HTMLButtonElement,
  expose: {
    Window: { HTMLButtonElement: HTMLButtonElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLButtonElement-impl.js");
