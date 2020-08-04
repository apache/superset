"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function WindowEventHandlers() {
  throw new TypeError("Illegal constructor");
}


WindowEventHandlers.prototype.toString = function () {
  if (this === WindowEventHandlers.prototype) {
    return "[object WindowEventHandlersPrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(WindowEventHandlers.prototype, "onafterprint", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onafterprint);
  },
  set(V) {
    this[impl].onafterprint = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onbeforeprint", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onbeforeprint);
  },
  set(V) {
    this[impl].onbeforeprint = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onbeforeunload", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onbeforeunload);
  },
  set(V) {
    this[impl].onbeforeunload = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onhashchange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onhashchange);
  },
  set(V) {
    this[impl].onhashchange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onlanguagechange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onlanguagechange);
  },
  set(V) {
    this[impl].onlanguagechange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onmessage", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmessage);
  },
  set(V) {
    this[impl].onmessage = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onoffline", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onoffline);
  },
  set(V) {
    this[impl].onoffline = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "ononline", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ononline);
  },
  set(V) {
    this[impl].ononline = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onpagehide", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onpagehide);
  },
  set(V) {
    this[impl].onpagehide = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onpageshow", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onpageshow);
  },
  set(V) {
    this[impl].onpageshow = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onpopstate", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onpopstate);
  },
  set(V) {
    this[impl].onpopstate = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onrejectionhandled", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onrejectionhandled);
  },
  set(V) {
    this[impl].onrejectionhandled = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onstorage", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onstorage);
  },
  set(V) {
    this[impl].onstorage = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onunhandledrejection", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onunhandledrejection);
  },
  set(V) {
    this[impl].onunhandledrejection = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(WindowEventHandlers.prototype, "onunload", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onunload);
  },
  set(V) {
    this[impl].onunload = utils.tryImplForWrapper(V);
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
    let obj = Object.create(WindowEventHandlers.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(WindowEventHandlers.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: WindowEventHandlers,
  expose: {
    Window: { WindowEventHandlers: WindowEventHandlers }
  }
};
module.exports = iface;

const Impl = require("../nodes/WindowEventHandlers-impl.js");
