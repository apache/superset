"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;

class Navigator {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  javaEnabled() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].javaEnabled();
  }

  get appCodeName() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["appCodeName"];
  }

  get appName() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["appName"];
  }

  get appVersion() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["appVersion"];
  }

  get platform() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["platform"];
  }

  get product() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["product"];
  }

  get productSub() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["productSub"];
  }

  get userAgent() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["userAgent"];
  }

  get vendor() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["vendor"];
  }

  get vendorSub() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["vendorSub"];
  }

  get language() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["language"];
  }

  get languages() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["languages"]);
  }

  get onLine() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["onLine"];
  }

  get cookieEnabled() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cookieEnabled"];
  }

  get plugins() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "plugins", () => {
      return utils.tryWrapperForImpl(this[impl]["plugins"]);
    });
  }

  get mimeTypes() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "mimeTypes", () => {
      return utils.tryWrapperForImpl(this[impl]["mimeTypes"]);
    });
  }

  get hardwareConcurrency() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["hardwareConcurrency"];
  }
}
Object.defineProperties(Navigator.prototype, {
  javaEnabled: { enumerable: true },
  appCodeName: { enumerable: true },
  appName: { enumerable: true },
  appVersion: { enumerable: true },
  platform: { enumerable: true },
  product: { enumerable: true },
  productSub: { enumerable: true },
  userAgent: { enumerable: true },
  vendor: { enumerable: true },
  vendorSub: { enumerable: true },
  language: { enumerable: true },
  languages: { enumerable: true },
  onLine: { enumerable: true },
  cookieEnabled: { enumerable: true },
  plugins: { enumerable: true },
  mimeTypes: { enumerable: true },
  hardwareConcurrency: { enumerable: true },
  [Symbol.toStringTag]: { value: "Navigator", configurable: true }
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
    throw new TypeError(`${context} is not of type 'Navigator'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(Navigator.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Navigator.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {},
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
  interface: Navigator,
  expose: {
    Window: { Navigator }
  }
}; // iface
module.exports = iface;

const Impl = require("../navigator/Navigator-impl.js");
