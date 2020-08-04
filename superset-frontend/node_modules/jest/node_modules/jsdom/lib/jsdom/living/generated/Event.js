"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertEventInit = require("./EventInit.js").convert;
const impl = utils.implSymbol;

class Event {
  constructor(type) {
    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to construct 'Event': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, { context: "Failed to construct 'Event': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = convertEventInit(curArg, { context: "Failed to construct 'Event': parameter 2" });
      args.push(curArg);
    }
    return iface.setup(Object.create(new.target.prototype), args);
  }

  composedPath() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].composedPath());
  }

  stopPropagation() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].stopPropagation();
  }

  stopImmediatePropagation() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].stopImmediatePropagation();
  }

  preventDefault() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].preventDefault();
  }

  initEvent(type) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'initEvent' on 'Event': 1 argument required, but only " + arguments.length + " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, { context: "Failed to execute 'initEvent' on 'Event': parameter 1" });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["boolean"](curArg, { context: "Failed to execute 'initEvent' on 'Event': parameter 2" });
      } else {
        curArg = false;
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        curArg = conversions["boolean"](curArg, { context: "Failed to execute 'initEvent' on 'Event': parameter 3" });
      } else {
        curArg = false;
      }
      args.push(curArg);
    }
    return this[impl].initEvent(...args);
  }

  get type() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["type"];
  }

  get target() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["target"]);
  }

  get srcElement() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["srcElement"]);
  }

  get currentTarget() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["currentTarget"]);
  }

  get eventPhase() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["eventPhase"];
  }

  get cancelBubble() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cancelBubble"];
  }

  set cancelBubble(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'cancelBubble' property on 'Event': The provided value"
    });

    this[impl]["cancelBubble"] = V;
  }

  get bubbles() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["bubbles"];
  }

  get cancelable() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cancelable"];
  }

  get returnValue() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["returnValue"];
  }

  set returnValue(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'returnValue' property on 'Event': The provided value"
    });

    this[impl]["returnValue"] = V;
  }

  get defaultPrevented() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["defaultPrevented"];
  }

  get composed() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["composed"];
  }

  get timeStamp() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["timeStamp"];
  }
}
Object.defineProperties(Event.prototype, {
  composedPath: { enumerable: true },
  stopPropagation: { enumerable: true },
  stopImmediatePropagation: { enumerable: true },
  preventDefault: { enumerable: true },
  initEvent: { enumerable: true },
  type: { enumerable: true },
  target: { enumerable: true },
  srcElement: { enumerable: true },
  currentTarget: { enumerable: true },
  eventPhase: { enumerable: true },
  cancelBubble: { enumerable: true },
  bubbles: { enumerable: true },
  cancelable: { enumerable: true },
  returnValue: { enumerable: true },
  defaultPrevented: { enumerable: true },
  composed: { enumerable: true },
  timeStamp: { enumerable: true },
  [Symbol.toStringTag]: { value: "Event", configurable: true },
  NONE: { value: 0, enumerable: true },
  CAPTURING_PHASE: { value: 1, enumerable: true },
  AT_TARGET: { value: 2, enumerable: true },
  BUBBLING_PHASE: { value: 3, enumerable: true }
});
Object.defineProperties(Event, {
  NONE: { value: 0, enumerable: true },
  CAPTURING_PHASE: { value: 1, enumerable: true },
  AT_TARGET: { value: 2, enumerable: true },
  BUBBLING_PHASE: { value: 3, enumerable: true }
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
    throw new TypeError(`${context} is not of type 'Event'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(Event.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Event.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Object.defineProperties(
      obj,
      Object.getOwnPropertyDescriptors({
        get isTrusted() {
          if (!this || !module.exports.is(this)) {
            throw new TypeError("Illegal invocation");
          }

          return obj[impl]["isTrusted"];
        }
      })
    );

    Object.defineProperties(obj, { isTrusted: { configurable: false } });
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
  interface: Event,
  expose: {
    Window: { Event },
    Worker: { Event },
    AudioWorklet: { Event }
  }
}; // iface
module.exports = iface;

const Impl = require("../events/Event-impl.js");
