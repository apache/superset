"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLMarqueeElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get behavior() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "behavior");
    return value === null ? "" : value;
  }

  set behavior(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'behavior' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "behavior", V);
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
      context: "Failed to set the 'bgColor' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "bgcolor", V);
  }

  get direction() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "direction");
    return value === null ? "" : value;
  }

  set direction(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'direction' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "direction", V);
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
      context: "Failed to set the 'height' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "height", V);
  }

  get hspace() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "hspace"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value;
  }

  set hspace(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'hspace' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "hspace", String(V > 2147483647 ? 0 : V));
  }

  get scrollAmount() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "scrollamount"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value;
  }

  set scrollAmount(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'scrollAmount' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "scrollamount", String(V > 2147483647 ? 0 : V));
  }

  get scrollDelay() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "scrolldelay"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value;
  }

  set scrollDelay(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'scrollDelay' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "scrolldelay", String(V > 2147483647 ? 0 : V));
  }

  get trueSpeed() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "truespeed");
  }

  set trueSpeed(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'trueSpeed' property on 'HTMLMarqueeElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "truespeed", "");
    } else {
      this[impl].removeAttributeNS(null, "truespeed");
    }
  }

  get vspace() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "vspace"));
    return isNaN(value) || value < 0 || value > 2147483647 ? 0 : value;
  }

  set vspace(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'vspace' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "vspace", String(V > 2147483647 ? 0 : V));
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
      context: "Failed to set the 'width' property on 'HTMLMarqueeElement': The provided value"
    });

    this[impl].setAttributeNS(null, "width", V);
  }
}
Object.defineProperties(HTMLMarqueeElement.prototype, {
  behavior: { enumerable: true },
  bgColor: { enumerable: true },
  direction: { enumerable: true },
  height: { enumerable: true },
  hspace: { enumerable: true },
  scrollAmount: { enumerable: true },
  scrollDelay: { enumerable: true },
  trueSpeed: { enumerable: true },
  vspace: { enumerable: true },
  width: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLMarqueeElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLMarqueeElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLMarqueeElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLMarqueeElement.prototype);
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
  interface: HTMLMarqueeElement,
  expose: {
    Window: { HTMLMarqueeElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLMarqueeElement-impl.js");
