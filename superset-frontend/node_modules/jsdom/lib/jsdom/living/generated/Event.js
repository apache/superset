"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;
const convertEventInit = require("./EventInit").convert;

function Event(type) {
  if (!this || this[impl] || !(this instanceof Event)) {
    throw new TypeError("Failed to construct 'Event': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'Event': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertEventInit(args[1]);

  iface.setup(this, args);
}


Event.prototype.stopPropagation = function stopPropagation() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].stopPropagation.apply(this[impl], args);
};

Event.prototype.stopImmediatePropagation = function stopImmediatePropagation() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].stopImmediatePropagation.apply(this[impl], args);
};

Event.prototype.preventDefault = function preventDefault() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].preventDefault.apply(this[impl], args);
};

Event.prototype.initEvent = function initEvent(type, bubbles, cancelable) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 3) {
    throw new TypeError("Failed to execute 'initEvent' on 'Event': 3 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  return this[impl].initEvent.apply(this[impl], args);
};

Event.prototype.toString = function () {
  if (this === Event.prototype) {
    return "[object EventPrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(Event.prototype, "type", {
  get() {
    return this[impl].type;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "target", {
  get() {
    return utils.tryWrapperForImpl(this[impl].target);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "currentTarget", {
  get() {
    return utils.tryWrapperForImpl(this[impl].currentTarget);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event, "NONE", {
  value: 0,
  enumerable: true
});
Object.defineProperty(Event.prototype, "NONE", {
  value: 0,
  enumerable: true
});

Object.defineProperty(Event, "CAPTURING_PHASE", {
  value: 1,
  enumerable: true
});
Object.defineProperty(Event.prototype, "CAPTURING_PHASE", {
  value: 1,
  enumerable: true
});

Object.defineProperty(Event, "AT_TARGET", {
  value: 2,
  enumerable: true
});
Object.defineProperty(Event.prototype, "AT_TARGET", {
  value: 2,
  enumerable: true
});

Object.defineProperty(Event, "BUBBLING_PHASE", {
  value: 3,
  enumerable: true
});
Object.defineProperty(Event.prototype, "BUBBLING_PHASE", {
  value: 3,
  enumerable: true
});

Object.defineProperty(Event.prototype, "eventPhase", {
  get() {
    return this[impl].eventPhase;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "cancelBubble", {
  get() {
    return this[impl].cancelBubble;
  },
  set(V) {
    V = conversions["boolean"](V);
    this[impl].cancelBubble = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "bubbles", {
  get() {
    return this[impl].bubbles;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "cancelable", {
  get() {
    return this[impl].cancelable;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "defaultPrevented", {
  get() {
    return this[impl].defaultPrevented;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Event.prototype, "timeStamp", {
  get() {
    return this[impl].timeStamp;
  },
  enumerable: true,
  configurable: true
});


const iface = {
  mixedInto: [],
  is(obj) {
    if (obj) {
      if (obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (obj instanceof module.exports.mixedInto[i]) {
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
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (wrapper instanceof module.exports.mixedInto[i]) {
          return true;
        }
      }
    }
    return false;
  },
  create(constructorArgs, privateData) {
    let obj = Object.create(Event.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Event.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Object.defineProperty(obj, "isTrusted", {
      get() {
        return obj[impl].isTrusted;
      },
      enumerable: true,
      configurable: false
    });
    
    
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: Event,
  expose: {
    Window: { Event: Event },
    Worker: { Event: Event }
  }
};
module.exports = iface;

const Impl = require("../events/Event-impl.js");
