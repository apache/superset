"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const isNode = require("./Node.js").is;
const impl = utils.implSymbol;
const Node = require("./Node.js");

class DocumentFragment extends Node.interface {
  constructor() {
    return iface.setup(Object.create(new.target.prototype));
  }

  getElementById(elementId) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementById' on 'DocumentFragment': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementById' on 'DocumentFragment': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementById(...args));
  }

  prepend() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'prepend' on 'DocumentFragment': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].prepend(...args);
  }

  append() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'append' on 'DocumentFragment': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].append(...args);
  }

  querySelector(selectors) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'querySelector' on 'DocumentFragment': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'querySelector' on 'DocumentFragment': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].querySelector(...args));
  }

  querySelectorAll(selectors) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'querySelectorAll' on 'DocumentFragment': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'querySelectorAll' on 'DocumentFragment': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].querySelectorAll(...args));
  }

  get children() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "children", () => {
      return utils.tryWrapperForImpl(this[impl]["children"]);
    });
  }

  get firstElementChild() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["firstElementChild"]);
  }

  get lastElementChild() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["lastElementChild"]);
  }

  get childElementCount() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["childElementCount"];
  }
}
Object.defineProperties(DocumentFragment.prototype, {
  getElementById: { enumerable: true },
  prepend: { enumerable: true },
  append: { enumerable: true },
  querySelector: { enumerable: true },
  querySelectorAll: { enumerable: true },
  children: { enumerable: true },
  firstElementChild: { enumerable: true },
  lastElementChild: { enumerable: true },
  childElementCount: { enumerable: true },
  [Symbol.toStringTag]: { value: "DocumentFragment", configurable: true },
  [Symbol.unscopables]: { value: { prepend: true, append: true, __proto__: null }, configurable: true }
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
    throw new TypeError(`${context} is not of type 'DocumentFragment'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(DocumentFragment.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(DocumentFragment.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Node._internalSetup(obj);
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
  interface: DocumentFragment,
  expose: {
    Window: { DocumentFragment }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/DocumentFragment-impl.js");
