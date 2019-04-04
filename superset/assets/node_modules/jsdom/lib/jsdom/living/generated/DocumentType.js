"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Node = require("./Node.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const ChildNode = require("./ChildNode.js");

function DocumentType() {
  throw new TypeError("Illegal constructor");
}
DocumentType.prototype = Object.create(Node.interface.prototype);
DocumentType.prototype.constructor = DocumentType;

mixin(DocumentType.prototype, ChildNode.interface.prototype);
ChildNode.mixedInto.push(DocumentType);

DocumentType.prototype.toString = function () {
  if (this === DocumentType.prototype) {
    return "[object DocumentTypePrototype]";
  }
  return Node.interface.prototype.toString.call(this);
};
Object.defineProperty(DocumentType.prototype, "name", {
  get() {
    return this[impl].name;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(DocumentType.prototype, "publicId", {
  get() {
    return this[impl].publicId;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(DocumentType.prototype, "systemId", {
  get() {
    return this[impl].systemId;
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
    let obj = Object.create(DocumentType.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(DocumentType.prototype);
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
  interface: DocumentType,
  expose: {
    Window: { DocumentType: DocumentType }
  }
};
module.exports = iface;

const Impl = require("../nodes/DocumentType-impl.js");
