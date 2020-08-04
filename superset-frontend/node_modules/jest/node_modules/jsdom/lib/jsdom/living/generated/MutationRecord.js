"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;

class MutationRecord {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get type() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["type"];
  }

  get target() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "target", () => {
      return utils.tryWrapperForImpl(this[impl]["target"]);
    });
  }

  get addedNodes() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "addedNodes", () => {
      return utils.tryWrapperForImpl(this[impl]["addedNodes"]);
    });
  }

  get removedNodes() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "removedNodes", () => {
      return utils.tryWrapperForImpl(this[impl]["removedNodes"]);
    });
  }

  get previousSibling() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["previousSibling"]);
  }

  get nextSibling() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["nextSibling"]);
  }

  get attributeName() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["attributeName"];
  }

  get attributeNamespace() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["attributeNamespace"];
  }

  get oldValue() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["oldValue"];
  }
}
Object.defineProperties(MutationRecord.prototype, {
  type: { enumerable: true },
  target: { enumerable: true },
  addedNodes: { enumerable: true },
  removedNodes: { enumerable: true },
  previousSibling: { enumerable: true },
  nextSibling: { enumerable: true },
  attributeName: { enumerable: true },
  attributeNamespace: { enumerable: true },
  oldValue: { enumerable: true },
  [Symbol.toStringTag]: { value: "MutationRecord", configurable: true }
});
const iface = {
  // When an interface-module that implements this interface as a mixin is loaded, it will append its own `.is()`
  // method into this array. It allows objects that directly implements *those* interfaces to be recognized as
  // implementing this mixin interface.
  _mixedIntoPredicates: [],
  is(obj) {
    if (obj) {
      if (utils.hasOwn(obj, impl) && obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(obj)) {
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
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(wrapper)) {
          return true;
        }
      }
    }
    return false;
  },
  convert(obj, { context = "The provided value" } = {}) {
    if (module.exports.is(obj)) {
      return utils.implForWrapper(obj);
    }
    throw new TypeError(`${context} is not of type 'MutationRecord'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(MutationRecord.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(MutationRecord.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {},
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};

    privateData.wrapper = obj;

    this._internalSetup(obj);
    Object.defineProperty(obj, impl, {
      value: new Impl.implementation(constructorArgs, privateData),
      configurable: true
    });

    obj[impl][utils.wrapperSymbol] = obj;
    if (Impl.init) {
      Impl.init(obj[impl], privateData);
    }
    return obj;
  },
  interface: MutationRecord,
  expose: {
    Window: { MutationRecord }
  }
}; // iface
module.exports = iface;

const Impl = require("../mutation-observer/MutationRecord-impl.js");
