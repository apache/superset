"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertHTMLTableCaptionElement = require("./HTMLTableCaptionElement.js").convert;
const convertHTMLTableSectionElement = require("./HTMLTableSectionElement.js").convert;
const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLTableElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  createCaption() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createCaption());
  }

  deleteCaption() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].deleteCaption();
  }

  createTHead() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createTHead());
  }

  deleteTHead() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].deleteTHead();
  }

  createTFoot() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createTFoot());
  }

  deleteTFoot() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].deleteTFoot();
  }

  createTBody() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createTBody());
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
          context: "Failed to execute 'insertRow' on 'HTMLTableElement': parameter 1"
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
        "Failed to execute 'deleteRow' on 'HTMLTableElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["long"](curArg, {
        context: "Failed to execute 'deleteRow' on 'HTMLTableElement': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].deleteRow(...args);
  }

  get caption() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["caption"]);
  }

  set caption(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = convertHTMLTableCaptionElement(V, {
        context: "Failed to set the 'caption' property on 'HTMLTableElement': The provided value"
      });
    }
    this[impl]["caption"] = V;
  }

  get tHead() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["tHead"]);
  }

  set tHead(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = convertHTMLTableSectionElement(V, {
        context: "Failed to set the 'tHead' property on 'HTMLTableElement': The provided value"
      });
    }
    this[impl]["tHead"] = V;
  }

  get tFoot() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["tFoot"]);
  }

  set tFoot(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = convertHTMLTableSectionElement(V, {
        context: "Failed to set the 'tFoot' property on 'HTMLTableElement': The provided value"
      });
    }
    this[impl]["tFoot"] = V;
  }

  get tBodies() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "tBodies", () => {
      return utils.tryWrapperForImpl(this[impl]["tBodies"]);
    });
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
      context: "Failed to set the 'align' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "align", V);
  }

  get border() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "border");
    return value === null ? "" : value;
  }

  set border(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'border' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "border", V);
  }

  get frame() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "frame");
    return value === null ? "" : value;
  }

  set frame(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'frame' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "frame", V);
  }

  get rules() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "rules");
    return value === null ? "" : value;
  }

  set rules(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'rules' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "rules", V);
  }

  get summary() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "summary");
    return value === null ? "" : value;
  }

  set summary(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'summary' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "summary", V);
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
      context: "Failed to set the 'width' property on 'HTMLTableElement': The provided value"
    });

    this[impl].setAttributeNS(null, "width", V);
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
      context: "Failed to set the 'bgColor' property on 'HTMLTableElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "bgcolor", V);
  }

  get cellPadding() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "cellpadding");
    return value === null ? "" : value;
  }

  set cellPadding(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'cellPadding' property on 'HTMLTableElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "cellpadding", V);
  }

  get cellSpacing() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "cellspacing");
    return value === null ? "" : value;
  }

  set cellSpacing(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'cellSpacing' property on 'HTMLTableElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "cellspacing", V);
  }
}
Object.defineProperties(HTMLTableElement.prototype, {
  createCaption: { enumerable: true },
  deleteCaption: { enumerable: true },
  createTHead: { enumerable: true },
  deleteTHead: { enumerable: true },
  createTFoot: { enumerable: true },
  deleteTFoot: { enumerable: true },
  createTBody: { enumerable: true },
  insertRow: { enumerable: true },
  deleteRow: { enumerable: true },
  caption: { enumerable: true },
  tHead: { enumerable: true },
  tFoot: { enumerable: true },
  tBodies: { enumerable: true },
  rows: { enumerable: true },
  align: { enumerable: true },
  border: { enumerable: true },
  frame: { enumerable: true },
  rules: { enumerable: true },
  summary: { enumerable: true },
  width: { enumerable: true },
  bgColor: { enumerable: true },
  cellPadding: { enumerable: true },
  cellSpacing: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLTableElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLTableElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableElement.prototype);
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
  interface: HTMLTableElement,
  expose: {
    Window: { HTMLTableElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLTableElement-impl.js");
