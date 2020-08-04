"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLTableCellElement = require("./HTMLTableCellElement.js");
const impl = utils.implSymbol;

function HTMLTableDataCellElement() {
  throw new TypeError("Illegal constructor");
}
HTMLTableDataCellElement.prototype = Object.create(HTMLTableCellElement.interface.prototype);
HTMLTableDataCellElement.prototype.constructor = HTMLTableDataCellElement;


HTMLTableDataCellElement.prototype.toString = function () {
  if (this === HTMLTableDataCellElement.prototype) {
    return "[object HTMLTableDataCellElementPrototype]";
  }
  return HTMLTableCellElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLTableDataCellElement.prototype, "abbr", {
  get() {
    const value = this.getAttribute("abbr");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("abbr", V);
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
    let obj = Object.create(HTMLTableDataCellElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableDataCellElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLTableCellElement._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: HTMLTableDataCellElement,
  expose: {
    Window: { HTMLTableDataCellElement: HTMLTableDataCellElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLTableDataCellElement-impl.js");
