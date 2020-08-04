"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Node = require("./Node.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const ChildNode = require("./ChildNode.js");
const NonDocumentTypeChildNode = require("./NonDocumentTypeChildNode.js");

function CharacterData() {
  throw new TypeError("Illegal constructor");
}
CharacterData.prototype = Object.create(Node.interface.prototype);
CharacterData.prototype.constructor = CharacterData;

mixin(CharacterData.prototype, ChildNode.interface.prototype);
ChildNode.mixedInto.push(CharacterData);
mixin(CharacterData.prototype, NonDocumentTypeChildNode.interface.prototype);
NonDocumentTypeChildNode.mixedInto.push(CharacterData);

CharacterData.prototype.substringData = function substringData(offset, count) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'substringData' on 'CharacterData': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["unsigned long"](args[0]);
  args[1] = conversions["unsigned long"](args[1]);
  return this[impl].substringData.apply(this[impl], args);
};

CharacterData.prototype.appendData = function appendData(data) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'appendData' on 'CharacterData': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].appendData.apply(this[impl], args);
};

CharacterData.prototype.insertData = function insertData(offset, data) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'insertData' on 'CharacterData': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["unsigned long"](args[0]);
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].insertData.apply(this[impl], args);
};

CharacterData.prototype.deleteData = function deleteData(offset, count) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'deleteData' on 'CharacterData': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["unsigned long"](args[0]);
  args[1] = conversions["unsigned long"](args[1]);
  return this[impl].deleteData.apply(this[impl], args);
};

CharacterData.prototype.replaceData = function replaceData(offset, count, data) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 3) {
    throw new TypeError("Failed to execute 'replaceData' on 'CharacterData': 3 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["unsigned long"](args[0]);
  args[1] = conversions["unsigned long"](args[1]);
  args[2] = conversions["DOMString"](args[2]);
  return this[impl].replaceData.apply(this[impl], args);
};

CharacterData.prototype.toString = function () {
  if (this === CharacterData.prototype) {
    return "[object CharacterDataPrototype]";
  }
  return Node.interface.prototype.toString.call(this);
};
Object.defineProperty(CharacterData.prototype, "data", {
  get() {
    return this[impl].data;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this[impl].data = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(CharacterData.prototype, "length", {
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
    let obj = Object.create(CharacterData.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(CharacterData.prototype);
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
  interface: CharacterData,
  expose: {
    Window: { CharacterData: CharacterData }
  }
};
module.exports = iface;

const Impl = require("../nodes/CharacterData-impl.js");
