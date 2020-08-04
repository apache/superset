"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function DOMImplementation() {
  throw new TypeError("Illegal constructor");
}


DOMImplementation.prototype.createDocumentType = function createDocumentType(qualifiedName, publicId, systemId) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 3) {
    throw new TypeError("Failed to execute 'createDocumentType' on 'DOMImplementation': 3 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["DOMString"](args[1]);
  args[2] = conversions["DOMString"](args[2]);
  return utils.tryWrapperForImpl(this[impl].createDocumentType.apply(this[impl], args));
};

DOMImplementation.prototype.createDocument = function createDocument(namespace, qualifiedName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'createDocument' on 'DOMImplementation': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1], { treatNullAsEmptyString: true });
  if (args[2] === null || args[2] === undefined) {
    args[2] = null;
  } else {
  }
  return utils.tryWrapperForImpl(this[impl].createDocument.apply(this[impl], args));
};

DOMImplementation.prototype.createHTMLDocument = function createHTMLDocument() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] !== undefined) {
  args[0] = conversions["DOMString"](args[0]);
  }
  return utils.tryWrapperForImpl(this[impl].createHTMLDocument.apply(this[impl], args));
};

DOMImplementation.prototype.hasFeature = function hasFeature() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].hasFeature.apply(this[impl], args);
};

DOMImplementation.prototype.toString = function () {
  if (this === DOMImplementation.prototype) {
    return "[object DOMImplementationPrototype]";
  }
  return this[impl].toString();
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
    let obj = Object.create(DOMImplementation.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(DOMImplementation.prototype);
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
  interface: DOMImplementation,
  expose: {
    Window: { DOMImplementation: DOMImplementation }
  }
};
module.exports = iface;

const Impl = require("../nodes/DOMImplementation-impl.js");
