"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Node = require("./Node.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const ParentNode = require("./ParentNode.js");

function DocumentFragment() {
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }

  iface.setup(this, args);
}
DocumentFragment.prototype = Object.create(Node.interface.prototype);
DocumentFragment.prototype.constructor = DocumentFragment;

mixin(DocumentFragment.prototype, ParentNode.interface.prototype);
ParentNode.mixedInto.push(DocumentFragment);

DocumentFragment.prototype.toString = function () {
  if (this === DocumentFragment.prototype) {
    return "[object DocumentFragmentPrototype]";
  }
  return Node.interface.prototype.toString.call(this);
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
    let obj = Object.create(DocumentFragment.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(DocumentFragment.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Node._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: DocumentFragment,
  expose: {
    Window: { DocumentFragment: DocumentFragment }
  }
};
module.exports = iface;

const Impl = require("../nodes/DocumentFragment-impl.js");
