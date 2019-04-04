"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function ElementCSSInlineStyle() {
  throw new TypeError("Illegal constructor");
}


ElementCSSInlineStyle.prototype.toString = function () {
  if (this === ElementCSSInlineStyle.prototype) {
    return "[object ElementCSSInlineStylePrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(ElementCSSInlineStyle.prototype, "style", {
  get() {
    return utils.tryWrapperForImpl(this[impl].style);
  },
  set(V) {
    this.style.cssText = V;
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
    let obj = Object.create(ElementCSSInlineStyle.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(ElementCSSInlineStyle.prototype);
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
  interface: ElementCSSInlineStyle,
  expose: {
    
  }
};
module.exports = iface;

const Impl = require("../nodes/ElementCSSInlineStyle-impl.js");
