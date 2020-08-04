"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;

class Location {
  constructor() {
    throw new TypeError("Illegal constructor");
  }
}
Object.defineProperties(Location.prototype, { [Symbol.toStringTag]: { value: "Location", configurable: true } });
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
    throw new TypeError(`${context} is not of type 'Location'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(Location.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Location.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Object.defineProperties(
      obj,
      Object.getOwnPropertyDescriptors({
        assign(url) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          if (arguments.length < 1) {
            throw new TypeError(
              "Failed to execute 'assign' on 'Location': 1 argument required, but only " +
                arguments.length +
                " present."
            );
          }
          const args = [];
          {
            let curArg = arguments[0];
            curArg = conversions["USVString"](curArg, {
              context: "Failed to execute 'assign' on 'Location': parameter 1"
            });
            args.push(curArg);
          }
          return this[impl].assign(...args);
        },
        replace(url) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          if (arguments.length < 1) {
            throw new TypeError(
              "Failed to execute 'replace' on 'Location': 1 argument required, but only " +
                arguments.length +
                " present."
            );
          }
          const args = [];
          {
            let curArg = arguments[0];
            curArg = conversions["USVString"](curArg, {
              context: "Failed to execute 'replace' on 'Location': parameter 1"
            });
            args.push(curArg);
          }
          return this[impl].replace(...args);
        },
        reload() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return this[impl].reload();
        },
        get href() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["href"];
        },
        set href(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'href' property on 'Location': The provided value"
          });

          obj[impl]["href"] = V;
        },
        toString() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }
          return obj[impl]["href"];
        },
        get origin() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["origin"];
        },
        get protocol() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["protocol"];
        },
        set protocol(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'protocol' property on 'Location': The provided value"
          });

          obj[impl]["protocol"] = V;
        },
        get host() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["host"];
        },
        set host(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'host' property on 'Location': The provided value"
          });

          obj[impl]["host"] = V;
        },
        get hostname() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["hostname"];
        },
        set hostname(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'hostname' property on 'Location': The provided value"
          });

          obj[impl]["hostname"] = V;
        },
        get port() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["port"];
        },
        set port(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'port' property on 'Location': The provided value"
          });

          obj[impl]["port"] = V;
        },
        get pathname() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["pathname"];
        },
        set pathname(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'pathname' property on 'Location': The provided value"
          });

          obj[impl]["pathname"] = V;
        },
        get search() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["search"];
        },
        set search(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'search' property on 'Location': The provided value"
          });

          obj[impl]["search"] = V;
        },
        get hash() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["hash"];
        },
        set hash(V) {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          V = conversions["USVString"](V, {
            context: "Failed to set the 'hash' property on 'Location': The provided value"
          });

          obj[impl]["hash"] = V;
        }
      })
    );

    Object.defineProperties(obj, {
      assign: { configurable: false, writable: false },
      replace: { configurable: false, writable: false },
      reload: { configurable: false, writable: false },
      href: { configurable: false },
      toString: { configurable: false, writable: false },
      origin: { configurable: false },
      protocol: { configurable: false },
      host: { configurable: false },
      hostname: { configurable: false },
      port: { configurable: false },
      pathname: { configurable: false },
      search: { configurable: false },
      hash: { configurable: false }
    });
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
  interface: Location,
  expose: {
    Window: { Location }
  }
}; // iface
module.exports = iface;

const Impl = require("../window/Location-impl.js");
