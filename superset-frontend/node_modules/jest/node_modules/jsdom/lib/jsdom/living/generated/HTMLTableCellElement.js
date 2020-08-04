"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLTableCellElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get colSpan() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["colSpan"];
  }

  set colSpan(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'colSpan' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl]["colSpan"] = V;
  }

  get rowSpan() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["rowSpan"];
  }

  set rowSpan(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'rowSpan' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl]["rowSpan"] = V;
  }

  get headers() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "headers");
    return value === null ? "" : value;
  }

  set headers(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'headers' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "headers", V);
  }

  get cellIndex() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cellIndex"];
  }

  get scope() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["scope"];
  }

  set scope(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'scope' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl]["scope"] = V;
  }

  get abbr() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "abbr");
    return value === null ? "" : value;
  }

  set abbr(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'abbr' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "abbr", V);
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
      context: "Failed to set the 'align' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "align", V);
  }

  get axis() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "axis");
    return value === null ? "" : value;
  }

  set axis(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'axis' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "axis", V);
  }

  get height() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "height");
    return value === null ? "" : value;
  }

  set height(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'height' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "height", V);
  }

  get width() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "width");
    return value === null ? "" : value;
  }

  set width(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'width' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "width", V);
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
      context: "Failed to set the 'ch' property on 'HTMLTableCellElement': The provided value"
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
      context: "Failed to set the 'chOff' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "charoff", V);
  }

  get noWrap() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "nowrap");
  }

  set noWrap(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'noWrap' property on 'HTMLTableCellElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "nowrap", "");
    } else {
      this[impl].removeAttributeNS(null, "nowrap");
    }
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
      context: "Failed to set the 'vAlign' property on 'HTMLTableCellElement': The provided value"
    });

    this[impl].setAttributeNS(null, "valign", V);
  }

  get bgColor() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "bgcolor");
    return value === null ? "" : value;
  }

  set bgColor(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'bgColor' property on 'HTMLTableCellElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "bgcolor", V);
  }
}
Object.defineProperties(HTMLTableCellElement.prototype, {
  colSpan: { enumerable: true },
  rowSpan: { enumerable: true },
  headers: { enumerable: true },
  cellIndex: { enumerable: true },
  scope: { enumerable: true },
  abbr: { enumerable: true },
  align: { enumerable: true },
  axis: { enumerable: true },
  height: { enumerable: true },
  width: { enumerable: true },
  ch: { enumerable: true },
  chOff: { enumerable: true },
  noWrap: { enumerable: true },
  vAlign: { enumerable: true },
  bgColor: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLTableCellElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLTableCellElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableCellElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableCellElement.prototype);
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
  interface: HTMLTableCellElement,
  expose: {
    Window: { HTMLTableCellElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLTableCellElement-impl.js");
