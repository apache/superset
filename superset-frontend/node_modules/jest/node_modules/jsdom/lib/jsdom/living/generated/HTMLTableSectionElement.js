"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLTableSectionElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  insertRow() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    {
      let curArg = arguments[0];
      if (curArg !== undefined) {
        curArg = conversions["long"](curArg, {
          context: "Failed to execute 'insertRow' on 'HTMLTableSectionElement': parameter 1"
        });
      } else {
        curArg = -1;
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].insertRow(...args));
  }

  deleteRow(index) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'deleteRow' on 'HTMLTableSectionElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["long"](curArg, {
        context: "Failed to execute 'deleteRow' on 'HTMLTableSectionElement': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].deleteRow(...args);
  }

  get rows() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "rows", () => {
      return utils.tryWrapperForImpl(this[impl]["rows"]);
    });
  }

  get align() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "align");
    return value === null ? "" : value;
  }

  set align(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'align' property on 'HTMLTableSectionElement': The provided value"
    });

    this[impl].setAttributeNS(null, "align", V);
  }

  get ch() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "char");
    return value === null ? "" : value;
  }

  set ch(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'ch' property on 'HTMLTableSectionElement': The provided value"
    });

    this[impl].setAttributeNS(null, "char", V);
  }

  get chOff() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "charoff");
    return value === null ? "" : value;
  }

  set chOff(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'chOff' property on 'HTMLTableSectionElement': The provided value"
    });

    this[impl].setAttributeNS(null, "charoff", V);
  }

  get vAlign() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "valign");
    return value === null ? "" : value;
  }

  set vAlign(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'vAlign' property on 'HTMLTableSectionElement': The provided value"
    });

    this[impl].setAttributeNS(null, "valign", V);
  }
}
Object.defineProperties(HTMLTableSectionElement.prototype, {
  insertRow: { enumerable: true },
  deleteRow: { enumerable: true },
  rows: { enumerable: true },
  align: { enumerable: true },
  ch: { enumerable: true },
  chOff: { enumerable: true },
  vAlign: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLTableSectionElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLTableSectionElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableSectionElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableSectionElement.prototype);
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
  interface: HTMLTableSectionElement,
  expose: {
    Window: { HTMLTableSectionElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLTableSectionElement-impl.js");
