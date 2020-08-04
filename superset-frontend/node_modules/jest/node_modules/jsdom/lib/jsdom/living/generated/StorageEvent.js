"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertStorageEventInit = require("./StorageEventInit.js").convert;
const convertStorage = require("./Storage.js").convert;
const impl = utils.implSymbol;
const Event = require("./Event.js");

class StorageEvent extends Event.interface {
  constructor(type) {
    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to construct 'StorageEvent': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, { context: "Failed to construct 'StorageEvent': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = convertStorageEventInit(curArg, { context: "Failed to construct 'StorageEvent': parameter 2" });
      args.push(curArg);
    }
    return iface.setup(Object.create(new.target.prototype), args);
  }

  initStorageEvent(type) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'initStorageEvent' on 'StorageEvent': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["boolean"](curArg, {
          context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 2"
        });
      } else {
        curArg = false;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        curArg = conversions["boolean"](curArg, {
          context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 3"
        });
      } else {
        curArg = false;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[3];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 4"
          });
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[4];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 5"
          });
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[5];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 6"
          });
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[6];
      if (curArg !== undefined) {
        curArg = conversions["USVString"](curArg, {
          context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 7"
        });
      } else {
        curArg = "";
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[7];
      if (curArg !== undefined) {
        if (curArg === null || curArg === undefined) {
          curArg = null;
        } else {
          curArg = convertStorage(curArg, {
            context: "Failed to execute 'initStorageEvent' on 'StorageEvent': parameter 8"
          });
        }
      } else {
        curArg = null;
      }
      args.push(curArg);
    }
    return this[impl].initStorageEvent(...args);
  }

  get key() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["key"];
  }

  get oldValue() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["oldValue"];
  }

  get newValue() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["newValue"];
  }

  get url() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["url"];
  }

  get storageArea() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["storageArea"]);
  }
}
Object.defineProperties(StorageEvent.prototype, {
  initStorageEvent: { enumerable: true },
  key: { enumerable: true },
  oldValue: { enumerable: true },
  newValue: { enumerable: true },
  url: { enumerable: true },
  storageArea: { enumerable: true },
  [Symbol.toStringTag]: { value: "StorageEvent", configurable: true }
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
    throw new TypeError(`${context} is not of type 'StorageEvent'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(StorageEvent.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(StorageEvent.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Event._internalSetup(obj);
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
  interface: StorageEvent,
  expose: {
    Window: { StorageEvent }
  }
}; // iface
module.exports = iface;

const Impl = require("../events/StorageEvent-impl.js");
