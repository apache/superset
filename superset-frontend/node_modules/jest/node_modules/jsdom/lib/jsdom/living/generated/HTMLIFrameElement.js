"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLIFrameElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  getSVGDocument() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].getSVGDocument());
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
      context: "Failed to set the 'src' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl]["src"] = V;
  }

  get srcdoc() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "srcdoc");
    return value === null ? "" : value;
  }

  set srcdoc(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'srcdoc' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "srcdoc", V);
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
      context: "Failed to set the 'name' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "name", V);
  }

  get allowFullscreen() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "allowfullscreen");
  }

  set allowFullscreen(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'allowFullscreen' property on 'HTMLIFrameElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "allowfullscreen", "");
    } else {
      this[impl].removeAttributeNS(null, "allowfullscreen");
    }
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
      context: "Failed to set the 'width' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "width", V);
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
      context: "Failed to set the 'height' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "height", V);
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
      context: "Failed to set the 'align' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "align", V);
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
      context: "Failed to set the 'scrolling' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl].setAttributeNS(null, "scrolling", V);
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
      context: "Failed to set the 'frameBorder' property on 'HTMLIFrameElement': The provided value"
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
      context: "Failed to set the 'longDesc' property on 'HTMLIFrameElement': The provided value"
    });

    this[impl]["longDesc"] = V;
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
      context: "Failed to set the 'marginHeight' property on 'HTMLIFrameElement': The provided value",
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
      context: "Failed to set the 'marginWidth' property on 'HTMLIFrameElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl].setAttributeNS(null, "marginwidth", V);
  }
}
Object.defineProperties(HTMLIFrameElement.prototype, {
  getSVGDocument: { enumerable: true },
  src: { enumerable: true },
  srcdoc: { enumerable: true },
  name: { enumerable: true },
  allowFullscreen: { enumerable: true },
  width: { enumerable: true },
  height: { enumerable: true },
  contentDocument: { enumerable: true },
  contentWindow: { enumerable: true },
  align: { enumerable: true },
  scrolling: { enumerable: true },
  frameBorder: { enumerable: true },
  longDesc: { enumerable: true },
  marginHeight: { enumerable: true },
  marginWidth: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLIFrameElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLIFrameElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLIFrameElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLIFrameElement.prototype);
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
  interface: HTMLIFrameElement,
  expose: {
    Window: { HTMLIFrameElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLIFrameElement-impl.js");
