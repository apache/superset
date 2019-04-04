"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLOptionElement() {
  throw new TypeError("Illegal constructor");
}
HTMLOptionElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLOptionElement.prototype.constructor = HTMLOptionElement;


HTMLOptionElement.prototype.toString = function () {
  if (this === HTMLOptionElement.prototype) {
    return "[object HTMLOptionElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLOptionElement.prototype, "disabled", {
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

Object.defineProperty(HTMLOptionElement.prototype, "form", {
  get() {
    return utils.tryWrapperForImpl(this[impl].form);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "label", {
  get() {
    return this[impl].label;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].label = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "defaultSelected", {
  get() {
    return this.hasAttribute("selected");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("selected", "");
  } else {
    this.removeAttribute("selected");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "selected", {
  get() {
    return this[impl].selected;
  },
  set(V) {
    V = conversions["boolean"](V);
    this[impl].selected = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "value", {
  get() {
    return this[impl].value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].value = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "text", {
  get() {
    return this[impl].text;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].text = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLOptionElement.prototype, "index", {
  get() {
    return this[impl].index;
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
    let obj = Object.create(HTMLOptionElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLOptionElement.prototype);
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
  interface: HTMLOptionElement,
  expose: {
    Window: { HTMLOptionElement: HTMLOptionElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLOptionElement-impl.js");
