"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLInputElement() {
  throw new TypeError("Illegal constructor");
}
HTMLInputElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLInputElement.prototype.constructor = HTMLInputElement;


HTMLInputElement.prototype.select = function select() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].select.apply(this[impl], args);
};

HTMLInputElement.prototype.setRangeText = function setRangeText(replacement) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'setRangeText' on 'HTMLInputElement': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 4; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].setRangeText.apply(this[impl], args);
};

HTMLInputElement.prototype.setSelectionRange = function setSelectionRange(start, end) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'setSelectionRange' on 'HTMLInputElement': 2 arguments required, but only " + arguments.length + " present.");
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

HTMLInputElement.prototype.toString = function () {
  if (this === HTMLInputElement.prototype) {
    return "[object HTMLInputElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLInputElement.prototype, "accept", {
  get() {
    const value = this.getAttribute("accept");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("accept", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "alt", {
  get() {
    const value = this.getAttribute("alt");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("alt", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "autocomplete", {
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

Object.defineProperty(HTMLInputElement.prototype, "autofocus", {
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

Object.defineProperty(HTMLInputElement.prototype, "defaultChecked", {
  get() {
    return this.hasAttribute("checked");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("checked", "");
  } else {
    this.removeAttribute("checked");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "checked", {
  get() {
    return this[impl].checked;
  },
  set(V) {
    V = conversions["boolean"](V);
    this[impl].checked = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "dirName", {
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

Object.defineProperty(HTMLInputElement.prototype, "disabled", {
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

Object.defineProperty(HTMLInputElement.prototype, "form", {
  get() {
    return utils.tryWrapperForImpl(this[impl].form);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "files", {
  get() {
    return utils.tryWrapperForImpl(this[impl].files);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "formNoValidate", {
  get() {
    return this.hasAttribute("formNoValidate");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("formNoValidate", "");
  } else {
    this.removeAttribute("formNoValidate");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "formTarget", {
  get() {
    const value = this.getAttribute("formTarget");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("formTarget", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "inputMode", {
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

Object.defineProperty(HTMLInputElement.prototype, "max", {
  get() {
    const value = this.getAttribute("max");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("max", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "maxLength", {
  get() {
    return this[impl].maxLength;
  },
  set(V) {
    V = conversions["long"](V);
    this[impl].maxLength = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "min", {
  get() {
    const value = this.getAttribute("min");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("min", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "minLength", {
  get() {
    return this[impl].minLength;
  },
  set(V) {
    V = conversions["long"](V);
    this[impl].minLength = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "multiple", {
  get() {
    return this.hasAttribute("multiple");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("multiple", "");
  } else {
    this.removeAttribute("multiple");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "name", {
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

Object.defineProperty(HTMLInputElement.prototype, "pattern", {
  get() {
    const value = this.getAttribute("pattern");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("pattern", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "placeholder", {
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

Object.defineProperty(HTMLInputElement.prototype, "readOnly", {
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

Object.defineProperty(HTMLInputElement.prototype, "required", {
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

Object.defineProperty(HTMLInputElement.prototype, "size", {
  get() {
    return this[impl].size;
  },
  set(V) {
    V = conversions["unsigned long"](V);
    this[impl].size = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "src", {
  get() {
    const value = this.getAttribute("src");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("src", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "step", {
  get() {
    const value = this.getAttribute("step");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("step", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "type", {
  get() {
    return this[impl].type;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].type = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "defaultValue", {
  get() {
    const value = this.getAttribute("value");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("value", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "value", {
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

Object.defineProperty(HTMLInputElement.prototype, "selectionStart", {
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

Object.defineProperty(HTMLInputElement.prototype, "selectionEnd", {
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

Object.defineProperty(HTMLInputElement.prototype, "selectionDirection", {
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

Object.defineProperty(HTMLInputElement.prototype, "align", {
  get() {
    const value = this.getAttribute("align");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("align", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLInputElement.prototype, "useMap", {
  get() {
    const value = this.getAttribute("useMap");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("useMap", V);
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
    let obj = Object.create(HTMLInputElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLInputElement.prototype);
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
  interface: HTMLInputElement,
  expose: {
    Window: { HTMLInputElement: HTMLInputElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLInputElement-impl.js");
