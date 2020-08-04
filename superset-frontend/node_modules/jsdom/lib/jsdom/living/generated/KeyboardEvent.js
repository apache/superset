"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const UIEvent = require("./UIEvent.js");
const impl = utils.implSymbol;
const convertKeyboardEventInit = require("./KeyboardEventInit").convert;

function KeyboardEvent(typeArg) {
  if (!this || this[impl] || !(this instanceof KeyboardEvent)) {
    throw new TypeError("Failed to construct 'KeyboardEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'KeyboardEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertKeyboardEventInit(args[1]);

  iface.setup(this, args);
}
KeyboardEvent.prototype = Object.create(UIEvent.interface.prototype);
KeyboardEvent.prototype.constructor = KeyboardEvent;


KeyboardEvent.prototype.getModifierState = function getModifierState(keyArg) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getModifierState' on 'KeyboardEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].getModifierState.apply(this[impl], args);
};

KeyboardEvent.prototype.initKeyboardEvent = function initKeyboardEvent(typeArg, bubblesArg, cancelableArg, viewArg, keyArg, locationArg, modifiersListArg, repeat, locale) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 9) {
    throw new TypeError("Failed to execute 'initKeyboardEvent' on 'KeyboardEvent': 9 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 9; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  if (args[3] === null || args[3] === undefined) {
    args[3] = null;
  } else {
  }
  args[4] = conversions["DOMString"](args[4]);
  args[5] = conversions["unsigned long"](args[5]);
  args[6] = conversions["DOMString"](args[6]);
  args[7] = conversions["boolean"](args[7]);
  args[8] = conversions["DOMString"](args[8]);
  return this[impl].initKeyboardEvent.apply(this[impl], args);
};

KeyboardEvent.prototype.toString = function () {
  if (this === KeyboardEvent.prototype) {
    return "[object KeyboardEventPrototype]";
  }
  return UIEvent.interface.prototype.toString.call(this);
};
Object.defineProperty(KeyboardEvent, "DOM_KEY_LOCATION_STANDARD", {
  value: 0,
  enumerable: true
});
Object.defineProperty(KeyboardEvent.prototype, "DOM_KEY_LOCATION_STANDARD", {
  value: 0,
  enumerable: true
});

Object.defineProperty(KeyboardEvent, "DOM_KEY_LOCATION_LEFT", {
  value: 1,
  enumerable: true
});
Object.defineProperty(KeyboardEvent.prototype, "DOM_KEY_LOCATION_LEFT", {
  value: 1,
  enumerable: true
});

Object.defineProperty(KeyboardEvent, "DOM_KEY_LOCATION_RIGHT", {
  value: 2,
  enumerable: true
});
Object.defineProperty(KeyboardEvent.prototype, "DOM_KEY_LOCATION_RIGHT", {
  value: 2,
  enumerable: true
});

Object.defineProperty(KeyboardEvent, "DOM_KEY_LOCATION_NUMPAD", {
  value: 3,
  enumerable: true
});
Object.defineProperty(KeyboardEvent.prototype, "DOM_KEY_LOCATION_NUMPAD", {
  value: 3,
  enumerable: true
});

Object.defineProperty(KeyboardEvent.prototype, "key", {
  get() {
    return this[impl].key;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "code", {
  get() {
    return this[impl].code;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "location", {
  get() {
    return this[impl].location;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "ctrlKey", {
  get() {
    return this[impl].ctrlKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "shiftKey", {
  get() {
    return this[impl].shiftKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "altKey", {
  get() {
    return this[impl].altKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "metaKey", {
  get() {
    return this[impl].metaKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "repeat", {
  get() {
    return this[impl].repeat;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "isComposing", {
  get() {
    return this[impl].isComposing;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "charCode", {
  get() {
    return this[impl].charCode;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "keyCode", {
  get() {
    return this[impl].keyCode;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(KeyboardEvent.prototype, "which", {
  get() {
    return this[impl].which;
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
    let obj = Object.create(KeyboardEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(KeyboardEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    UIEvent._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: KeyboardEvent,
  expose: {
    Window: { KeyboardEvent: KeyboardEvent }
  }
};
module.exports = iface;

const Impl = require("../events/KeyboardEvent-impl.js");
