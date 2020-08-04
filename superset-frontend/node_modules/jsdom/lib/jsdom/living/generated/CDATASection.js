"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Text = require("./Text.js");
const impl = utils.implSymbol;

function CDATASection() {
  throw new TypeError("Illegal constructor");
}
CDATASection.prototype = Object.create(Text.interface.prototype);
CDATASection.prototype.constructor = CDATASection;


CDATASection.prototype.toString = function () {
  if (this === CDATASection.prototype) {
    return "[object CDATASectionPrototype]";
  }
  return Text.interface.prototype.toString.call(this);
};

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
    let obj = Object.create(CDATASection.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(CDATASection.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Text._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: CDATASection,
  expose: {
    Window: { CDATASection: CDATASection }
  }
};
module.exports = iface;

const Impl = require("../nodes/CDATASection-impl.js");
