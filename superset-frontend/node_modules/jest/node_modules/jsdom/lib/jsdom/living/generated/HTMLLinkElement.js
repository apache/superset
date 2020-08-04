"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLLinkElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get href() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["href"];
  }

  set href(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'href' property on 'HTMLLinkElement': The provided value"
    });

    this[impl]["href"] = V;
  }

  get crossOrigin() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "crossorigin");
    return value === null ? "" : value;
  }

  set crossOrigin(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = conversions["DOMString"](V, {
        context: "Failed to set the 'crossOrigin' property on 'HTMLLinkElement': The provided value"
      });
    }
    this[impl].setAttributeNS(null, "crossorigin", V);
  }

  get rel() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "rel");
    return value === null ? "" : value;
  }

  set rel(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'rel' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "rel", V);
  }

  get relList() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "relList", () => {
      return utils.tryWrapperForImpl(this[impl]["relList"]);
    });
  }

  set relList(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    this.relList.value = V;
  }

  get media() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "media");
    return value === null ? "" : value;
  }

  set media(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'media' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "media", V);
  }

  get hreflang() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "hreflang");
    return value === null ? "" : value;
  }

  set hreflang(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'hreflang' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "hreflang", V);
  }

  get type() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "type");
    return value === null ? "" : value;
  }

  set type(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'type' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "type", V);
  }

  get charset() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "charset");
    return value === null ? "" : value;
  }

  set charset(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'charset' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "charset", V);
  }

  get rev() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "rev");
    return value === null ? "" : value;
  }

  set rev(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'rev' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "rev", V);
  }

  get target() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "target");
    return value === null ? "" : value;
  }

  set target(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'target' property on 'HTMLLinkElement': The provided value"
    });

    this[impl].setAttributeNS(null, "target", V);
  }

  get sheet() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["sheet"]);
  }
}
Object.defineProperties(HTMLLinkElement.prototype, {
  href: { enumerable: true },
  crossOrigin: { enumerable: true },
  rel: { enumerable: true },
  relList: { enumerable: true },
  media: { enumerable: true },
  hreflang: { enumerable: true },
  type: { enumerable: true },
  charset: { enumerable: true },
  rev: { enumerable: true },
  target: { enumerable: true },
  sheet: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLLinkElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLLinkElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLLinkElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLLinkElement.prototype);
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
  interface: HTMLLinkElement,
  expose: {
    Window: { HTMLLinkElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLLinkElement-impl.js");
