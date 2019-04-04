"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const UIEvent = require("./UIEvent.js");
const impl = utils.implSymbol;
const convertMouseEventInit = require("./MouseEventInit").convert;

function MouseEvent(typeArg) {
  if (!this || this[impl] || !(this instanceof MouseEvent)) {
    throw new TypeError("Failed to construct 'MouseEvent': Please use the 'new' operator, this DOM object constructor cannot be called as a function.");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to construct 'MouseEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = convertMouseEventInit(args[1]);

  iface.setup(this, args);
}
MouseEvent.prototype = Object.create(UIEvent.interface.prototype);
MouseEvent.prototype.constructor = MouseEvent;


MouseEvent.prototype.getModifierState = function getModifierState(keyArg) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getModifierState' on 'MouseEvent': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].getModifierState.apply(this[impl], args);
};

MouseEvent.prototype.initMouseEvent = function initMouseEvent(typeArg, bubblesArg, cancelableArg, viewArg, detailArg, screenXArg, screenYArg, clientXArg, clientYArg, ctrlKeyArg, altKeyArg, shiftKeyArg, metaKeyArg, buttonArg, relatedTargetArg) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 15) {
    throw new TypeError("Failed to execute 'initMouseEvent' on 'MouseEvent': 15 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 15; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["boolean"](args[1]);
  args[2] = conversions["boolean"](args[2]);
  if (args[3] === null || args[3] === undefined) {
    args[3] = null;
  } else {
  }
  args[4] = conversions["long"](args[4]);
  args[5] = conversions["long"](args[5]);
  args[6] = conversions["long"](args[6]);
  args[7] = conversions["long"](args[7]);
  args[8] = conversions["long"](args[8]);
  args[9] = conversions["boolean"](args[9]);
  args[10] = conversions["boolean"](args[10]);
  args[11] = conversions["boolean"](args[11]);
  args[12] = conversions["boolean"](args[12]);
  args[13] = conversions["short"](args[13]);
  if (args[14] === null || args[14] === undefined) {
    args[14] = null;
  } else {
  }
  return this[impl].initMouseEvent.apply(this[impl], args);
};

MouseEvent.prototype.toString = function () {
  if (this === MouseEvent.prototype) {
    return "[object MouseEventPrototype]";
  }
  return UIEvent.interface.prototype.toString.call(this);
};
Object.defineProperty(MouseEvent.prototype, "screenX", {
  get() {
    return this[impl].screenX;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "screenY", {
  get() {
    return this[impl].screenY;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "clientX", {
  get() {
    return this[impl].clientX;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "clientY", {
  get() {
    return this[impl].clientY;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "ctrlKey", {
  get() {
    return this[impl].ctrlKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "shiftKey", {
  get() {
    return this[impl].shiftKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "altKey", {
  get() {
    return this[impl].altKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "metaKey", {
  get() {
    return this[impl].metaKey;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "button", {
  get() {
    return this[impl].button;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "relatedTarget", {
  get() {
    return utils.tryWrapperForImpl(this[impl].relatedTarget);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(MouseEvent.prototype, "buttons", {
  get() {
    return this[impl].buttons;
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
    let obj = Object.create(MouseEvent.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(MouseEvent.prototype);
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
  interface: MouseEvent,
  expose: {
    Window: { MouseEvent: MouseEvent }
  }
};
module.exports = iface;

const Impl = require("../events/MouseEvent-impl.js");
