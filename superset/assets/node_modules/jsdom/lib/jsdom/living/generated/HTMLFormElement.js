"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLFormElement() {
  throw new TypeError("Illegal constructor");
}
HTMLFormElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLFormElement.prototype.constructor = HTMLFormElement;


HTMLFormElement.prototype.submit = function submit() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].submit.apply(this[impl], args);
};

HTMLFormElement.prototype.reset = function reset() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].reset.apply(this[impl], args);
};

HTMLFormElement.prototype.toString = function () {
  if (this === HTMLFormElement.prototype) {
    return "[object HTMLFormElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLFormElement.prototype, "acceptCharset", {
  get() {
    const value = this.getAttribute("accept-charset");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("accept-charset", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "action", {
  get() {
    return this[impl].action;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].action = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "enctype", {
  get() {
    return this[impl].enctype;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].enctype = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "method", {
  get() {
    return this[impl].method;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].method = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "name", {
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

Object.defineProperty(HTMLFormElement.prototype, "noValidate", {
  get() {
    return this.hasAttribute("noValidate");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("noValidate", "");
  } else {
    this.removeAttribute("noValidate");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "target", {
  get() {
    const value = this.getAttribute("target");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("target", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "elements", {
  get() {
    return utils.tryWrapperForImpl(this[impl].elements);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLFormElement.prototype, "length", {
  get() {
    return this[impl].length;
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
    let obj = Object.create(HTMLFormElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLFormElement.prototype);
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
  interface: HTMLFormElement,
  expose: {
    Window: { HTMLFormElement: HTMLFormElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLFormElement-impl.js");
