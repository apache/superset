"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Blob = require("./Blob.js");
const impl = utils.implSymbol;
const convertFilePropertyBag = require("./FilePropertyBag").convert;

function File(fileBits, fileName) {
  if (!this || this[impl] || !(this instanceof File)) {
    throw new TypeError("Failed to construct 'File': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to construct 'File': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[1] = conversions["USVString"](args[1]);
  args[2] = convertFilePropertyBag(args[2]);

  iface.setup(this, args);
}
File.prototype = Object.create(Blob.interface.prototype);
File.prototype.constructor = File;


File.prototype.toString = function () {
  if (this === File.prototype) {
    return "[object FilePrototype]";
  }
  return Blob.interface.prototype.toString.call(this);
};
Object.defineProperty(File.prototype, "name", {
  get() {
    return this[impl].name;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(File.prototype, "lastModified", {
  get() {
    return this[impl].lastModified;
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
    let obj = Object.create(File.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(File.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Blob._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: File,
  expose: {
    Window: { File: File },
    Worker: { File: File }
  }
};
module.exports = iface;

const Impl = require("../file-api/File-impl.js");
