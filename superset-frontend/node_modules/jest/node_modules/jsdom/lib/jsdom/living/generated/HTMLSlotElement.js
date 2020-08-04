"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertAssignedNodesOptions = require("./AssignedNodesOptions.js").convert;
const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLSlotElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  assignedNodes() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertAssignedNodesOptions(curArg, {
        context: "Failed to execute 'assignedNodes' on 'HTMLSlotElement': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].assignedNodes(...args));
  }

  assignedElements() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertAssignedNodesOptions(curArg, {
        context: "Failed to execute 'assignedElements' on 'HTMLSlotElement': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].assignedElements(...args));
  }

  get name() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "name");
    return value === null ? "" : value;
  }

  set name(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'name' property on 'HTMLSlotElement': The provided value"
    });

    this[impl].setAttributeNS(null, "name", V);
  }
}
Object.defineProperties(HTMLSlotElement.prototype, {
  assignedNodes: { enumerable: true },
  assignedElements: { enumerable: true },
  name: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLSlotElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLSlotElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLSlotElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLSlotElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLElement._internalSetup(obj);
  },
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
  interface: HTMLSlotElement,
  expose: {
    Window: { HTMLSlotElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLSlotElement-impl.js");
