"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const isNode = require("./Node.js").is;
const impl = utils.implSymbol;
const Node = require("./Node.js");

class CharacterData extends Node.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  substringData(offset, count) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'substringData' on 'CharacterData': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'substringData' on 'CharacterData': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'substringData' on 'CharacterData': parameter 2"
      });
      args.push(curArg);
    }
    return this[impl].substringData(...args);
  }

  appendData(data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'appendData' on 'CharacterData': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'appendData' on 'CharacterData': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].appendData(...args);
  }

  insertData(offset, data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'insertData' on 'CharacterData': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'insertData' on 'CharacterData': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'insertData' on 'CharacterData': parameter 2"
      });
      args.push(curArg);
    }
    return this[impl].insertData(...args);
  }

  deleteData(offset, count) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'deleteData' on 'CharacterData': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'deleteData' on 'CharacterData': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'deleteData' on 'CharacterData': parameter 2"
      });
      args.push(curArg);
    }
    return this[impl].deleteData(...args);
  }

  replaceData(offset, count, data) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 3) {
      throw new TypeError(
        "Failed to execute 'replaceData' on 'CharacterData': 3 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'replaceData' on 'CharacterData': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'replaceData' on 'CharacterData': parameter 2"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'replaceData' on 'CharacterData': parameter 3"
      });
      args.push(curArg);
    }
    return this[impl].replaceData(...args);
  }

  before() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'before' on 'CharacterData': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].before(...args);
  }

  after() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'after' on 'CharacterData': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].after(...args);
  }

  replaceWith() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }
    const args = [];
    for (let i = 0; i < arguments.length; i++) {
      let curArg = arguments[i];
      if (isNode(curArg)) {
        curArg = utils.implForWrapper(curArg);
      } else {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'replaceWith' on 'CharacterData': parameter " + (i + 1)
        });
      }
      args.push(curArg);
    }
    return this[impl].replaceWith(...args);
  }

  remove() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].remove();
  }

  get data() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["data"];
  }

  set data(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'data' property on 'CharacterData': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl]["data"] = V;
  }

  get length() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["length"];
  }

  get previousElementSibling() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["previousElementSibling"]);
  }

  get nextElementSibling() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["nextElementSibling"]);
  }
}
Object.defineProperties(CharacterData.prototype, {
  substringData: { enumerable: true },
  appendData: { enumerable: true },
  insertData: { enumerable: true },
  deleteData: { enumerable: true },
  replaceData: { enumerable: true },
  before: { enumerable: true },
  after: { enumerable: true },
  replaceWith: { enumerable: true },
  remove: { enumerable: true },
  data: { enumerable: true },
  length: { enumerable: true },
  previousElementSibling: { enumerable: true },
  nextElementSibling: { enumerable: true },
  [Symbol.toStringTag]: { value: "CharacterData", configurable: true },
  [Symbol.unscopables]: {
    value: { before: true, after: true, replaceWith: true, remove: true, __proto__: null },
    configurable: true
  }
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
    throw new TypeError(`${context} is not of type 'CharacterData'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(CharacterData.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(CharacterData.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Node._internalSetup(obj);
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
  interface: CharacterData,
  expose: {
    Window: { CharacterData }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/CharacterData-impl.js");
