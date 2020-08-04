"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLTrackElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get kind() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "kind");
    return value === null ? "" : value;
  }

  set kind(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'kind' property on 'HTMLTrackElement': The provided value"
    });

    this[impl].setAttributeNS(null, "kind", V);
  }

  get src() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["src"];
  }

  set src(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'src' property on 'HTMLTrackElement': The provided value"
    });

    this[impl]["src"] = V;
  }

  get srclang() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "srclang");
    return value === null ? "" : value;
  }

  set srclang(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'srclang' property on 'HTMLTrackElement': The provided value"
    });

    this[impl].setAttributeNS(null, "srclang", V);
  }

  get label() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "label");
    return value === null ? "" : value;
  }

  set label(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'label' property on 'HTMLTrackElement': The provided value"
    });

    this[impl].setAttributeNS(null, "label", V);
  }

  get default() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "default");
  }

  set default(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'default' property on 'HTMLTrackElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "default", "");
    } else {
      this[impl].removeAttributeNS(null, "default");
    }
  }

  get readyState() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["readyState"];
  }
}
Object.defineProperties(HTMLTrackElement.prototype, {
  kind: { enumerable: true },
  src: { enumerable: true },
  srclang: { enumerable: true },
  label: { enumerable: true },
  default: { enumerable: true },
  readyState: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLTrackElement", configurable: true },
  NONE: { value: 0, enumerable: true },
  LOADING: { value: 1, enumerable: true },
  LOADED: { value: 2, enumerable: true },
  ERROR: { value: 3, enumerable: true }
});
Object.defineProperties(HTMLTrackElement, {
  NONE: { value: 0, enumerable: true },
  LOADING: { value: 1, enumerable: true },
  LOADED: { value: 2, enumerable: true },
  ERROR: { value: 3, enumerable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLTrackElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLTrackElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTrackElement.prototype);
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
  interface: HTMLTrackElement,
  expose: {
    Window: { HTMLTrackElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLTrackElement-impl.js");
