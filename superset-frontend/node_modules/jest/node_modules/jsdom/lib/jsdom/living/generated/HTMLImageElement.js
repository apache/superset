"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLImageElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  get alt() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "alt");
    return value === null ? "" : value;
  }

  set alt(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'alt' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "alt", V);
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
      context: "Failed to set the 'src' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["src"] = V;
  }

  get srcset() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["srcset"];
  }

  set srcset(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'srcset' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["srcset"] = V;
  }

  get sizes() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "sizes");
    return value === null ? "" : value;
  }

  set sizes(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'sizes' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "sizes", V);
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
        context: "Failed to set the 'crossOrigin' property on 'HTMLImageElement': The provided value"
      });
    }
    this[impl].setAttributeNS(null, "crossorigin", V);
  }

  get useMap() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "usemap");
    return value === null ? "" : value;
  }

  set useMap(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'useMap' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "usemap", V);
  }

  get isMap() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "ismap");
  }

  set isMap(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'isMap' property on 'HTMLImageElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "ismap", "");
    } else {
      this[impl].removeAttributeNS(null, "ismap");
    }
  }

  get width() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["width"];
  }

  set width(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'width' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["width"] = V;
  }

  get height() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["height"];
  }

  set height(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'height' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["height"] = V;
  }

  get naturalWidth() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["naturalWidth"];
  }

  get naturalHeight() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["naturalHeight"];
  }

  get complete() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["complete"];
  }

  get currentSrc() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["currentSrc"];
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
      context: "Failed to set the 'name' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "name", V);
  }

  get lowsrc() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["lowsrc"];
  }

  set lowsrc(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'lowsrc' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["lowsrc"] = V;
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
      context: "Failed to set the 'align' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "align", V);
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
      context: "Failed to set the 'hspace' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "hspace", String(V > 2147483647 ? 0 : V));
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
      context: "Failed to set the 'vspace' property on 'HTMLImageElement': The provided value"
    });

    this[impl].setAttributeNS(null, "vspace", String(V > 2147483647 ? 0 : V));
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
      context: "Failed to set the 'longDesc' property on 'HTMLImageElement': The provided value"
    });

    this[impl]["longDesc"] = V;
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
      context: "Failed to set the 'border' property on 'HTMLImageElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "border", V);
  }
}
Object.defineProperties(HTMLImageElement.prototype, {
  alt: { enumerable: true },
  src: { enumerable: true },
  srcset: { enumerable: true },
  sizes: { enumerable: true },
  crossOrigin: { enumerable: true },
  useMap: { enumerable: true },
  isMap: { enumerable: true },
  width: { enumerable: true },
  height: { enumerable: true },
  naturalWidth: { enumerable: true },
  naturalHeight: { enumerable: true },
  complete: { enumerable: true },
  currentSrc: { enumerable: true },
  name: { enumerable: true },
  lowsrc: { enumerable: true },
  align: { enumerable: true },
  hspace: { enumerable: true },
  vspace: { enumerable: true },
  longDesc: { enumerable: true },
  border: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLImageElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLImageElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLImageElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLImageElement.prototype);
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
  interface: HTMLImageElement,
  expose: {
    Window: { HTMLImageElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLImageElement-impl.js");
