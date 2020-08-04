"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLFrameElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
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
      context: "Failed to set the 'name' property on 'HTMLFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "name", V);
  }

  get scrolling() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "scrolling");
    return value === null ? "" : value;
  }

  set scrolling(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'scrolling' property on 'HTMLFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "scrolling", V);
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
      context: "Failed to set the 'src' property on 'HTMLFrameElement': The provided value"
    });

    this[impl]["src"] = V;
  }

  get frameBorder() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "frameborder");
    return value === null ? "" : value;
  }

  set frameBorder(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'frameBorder' property on 'HTMLFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "frameborder", V);
  }

  get longDesc() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["longDesc"];
  }

  set longDesc(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'longDesc' property on 'HTMLFrameElement': The provided value"
    });

    this[impl]["longDesc"] = V;
  }

  get noResize() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "noresize");
  }

  set noResize(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'noResize' property on 'HTMLFrameElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "noresize", "");
    } else {
      this[impl].removeAttributeNS(null, "noresize");
    }
  }

  get contentDocument() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["contentDocument"]);
  }

  get contentWindow() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["contentWindow"]);
  }

  get marginHeight() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "marginheight");
    return value === null ? "" : value;
  }

  set marginHeight(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'marginHeight' property on 'HTMLFrameElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "marginheight", V);
  }

  get marginWidth() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "marginwidth");
    return value === null ? "" : value;
  }

  set marginWidth(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'marginWidth' property on 'HTMLFrameElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "marginwidth", V);
  }
}
Object.defineProperties(HTMLFrameElement.prototype, {
  name: { enumerable: true },
  scrolling: { enumerable: true },
  src: { enumerable: true },
  frameBorder: { enumerable: true },
  longDesc: { enumerable: true },
  noResize: { enumerable: true },
  contentDocument: { enumerable: true },
  contentWindow: { enumerable: true },
  marginHeight: { enumerable: true },
  marginWidth: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLFrameElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLFrameElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLFrameElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLFrameElement.prototype);
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
  interface: HTMLFrameElement,
  expose: {
    Window: { HTMLFrameElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLFrameElement-impl.js");
