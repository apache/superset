"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLTextAreaElement() {
  throw new TypeError("Illegal constructor");
}
HTMLTextAreaElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLTextAreaElement.prototype.constructor = HTMLTextAreaElement;


HTMLTextAreaElement.prototype.select = function select() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].select.apply(this[impl], args);
};

HTMLTextAreaElement.prototype.setRangeText = function setRangeText(replacement) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'setRangeText' on 'HTMLTextAreaElement': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 4; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].setRangeText.apply(this[impl], args);
};

HTMLTextAreaElement.prototype.setSelectionRange = function setSelectionRange(start, end) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'setSelectionRange' on 'HTMLTextAreaElement': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["unsigned long"](args[0]);
  args[1] = conversions["unsigned long"](args[1]);
  if (args[2] !== undefined) {
  args[2] = conversions["DOMString"](args[2]);
  }
  return this[impl].setSelectionRange.apply(this[impl], args);
};

HTMLTextAreaElement.prototype.toString = function () {
  if (this === HTMLTextAreaElement.prototype) {
    return "[object HTMLTextAreaElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLTextAreaElement.prototype, "autocomplete", {
  get() {
    const value = this.getAttribute("autocomplete");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("autocomplete", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "autofocus", {
  get() {
    return this.hasAttribute("autofocus");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("autofocus", "");
  } else {
    this.removeAttribute("autofocus");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "cols", {
  get() {
    return this[impl].cols;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].cols = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "dirName", {
  get() {
    const value = this.getAttribute("dirName");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("dirName", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "disabled", {
  get() {
    return this.hasAttribute("disabled");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("disabled", "");
  } else {
    this.removeAttribute("disabled");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "form", {
  get() {
    return utils.tryWrapperForImpl(this[impl].form);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "inputMode", {
  get() {
    const value = this.getAttribute("inputMode");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("inputMode", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "maxLength", {
  get() {
    const value = parseInt(this.getAttribute("maxLength"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["long"](V);
    this.setAttribute("maxLength", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "minLength", {
  get() {
    const value = parseInt(this.getAttribute("minLength"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value
  },
  set(V) {
    V = conversions["long"](V);
    this.setAttribute("minLength", String(V));
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "name", {
  get() {
    const value = this.getAttribute("name");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("name", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "placeholder", {
  get() {
    const value = this.getAttribute("placeholder");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("placeholder", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "readOnly", {
  get() {
    return this.hasAttribute("readOnly");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("readOnly", "");
  } else {
    this.removeAttribute("readOnly");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "required", {
  get() {
    return this.hasAttribute("required");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("required", "");
  } else {
    this.removeAttribute("required");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "rows", {
  get() {
    return this[impl].rows;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].rows = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "wrap", {
  get() {
    const value = this.getAttribute("wrap");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("wrap", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "type", {
  get() {
    return this[impl].type;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "defaultValue", {
  get() {
    return this[impl].defaultValue;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].defaultValue = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
  get() {
    return this[impl].value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this[impl].value = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "textLength", {
  get() {
    return this[impl].textLength;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "selectionStart", {
  get() {
    return this[impl].selectionStart;
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    V = conversions["unsigned long"](V);
    }
    this[impl].selectionStart = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "selectionEnd", {
  get() {
    return this[impl].selectionEnd;
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    V = conversions["unsigned long"](V);
    }
    this[impl].selectionEnd = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTextAreaElement.prototype, "selectionDirection", {
  get() {
    return this[impl].selectionDirection;
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    V = conversions["DOMString"](V);
    }
    this[impl].selectionDirection = V;
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
    let obj = Object.create(HTMLTextAreaElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTextAreaElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLElement._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: HTMLTextAreaElement,
  expose: {
    Window: { HTMLTextAreaElement: HTMLTextAreaElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLTextAreaElement-impl.js");
