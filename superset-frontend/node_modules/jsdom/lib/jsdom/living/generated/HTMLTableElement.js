"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLTableElement() {
  throw new TypeError("Illegal constructor");
}
HTMLTableElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLTableElement.prototype.constructor = HTMLTableElement;


HTMLTableElement.prototype.createCaption = function createCaption() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].createCaption.apply(this[impl], args));
};

HTMLTableElement.prototype.deleteCaption = function deleteCaption() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].deleteCaption.apply(this[impl], args);
};

HTMLTableElement.prototype.createTHead = function createTHead() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].createTHead.apply(this[impl], args));
};

HTMLTableElement.prototype.deleteTHead = function deleteTHead() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].deleteTHead.apply(this[impl], args);
};

HTMLTableElement.prototype.createTFoot = function createTFoot() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].createTFoot.apply(this[impl], args));
};

HTMLTableElement.prototype.deleteTFoot = function deleteTFoot() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].deleteTFoot.apply(this[impl], args);
};

HTMLTableElement.prototype.insertRow = function insertRow() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] !== undefined) {
  args[0] = conversions["long"](args[0]);
  } else {
    args[0] = -1;
  }
  return utils.tryWrapperForImpl(this[impl].insertRow.apply(this[impl], args));
};

HTMLTableElement.prototype.deleteRow = function deleteRow(index) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'deleteRow' on 'HTMLTableElement': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["long"](args[0]);
  return this[impl].deleteRow.apply(this[impl], args);
};

HTMLTableElement.prototype.toString = function () {
  if (this === HTMLTableElement.prototype) {
    return "[object HTMLTableElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLTableElement.prototype, "caption", {
  get() {
    return utils.tryWrapperForImpl(this[impl].caption);
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    }
    this[impl].caption = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "tHead", {
  get() {
    return utils.tryWrapperForImpl(this[impl].tHead);
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    }
    this[impl].tHead = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "tFoot", {
  get() {
    return utils.tryWrapperForImpl(this[impl].tFoot);
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    }
    this[impl].tFoot = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "tBodies", {
  get() {
    return utils.tryWrapperForImpl(this[impl].tBodies);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "rows", {
  get() {
    return utils.tryWrapperForImpl(this[impl].rows);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "align", {
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

Object.defineProperty(HTMLTableElement.prototype, "border", {
  get() {
    const value = this.getAttribute("border");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("border", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "frame", {
  get() {
    const value = this.getAttribute("frame");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("frame", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "rules", {
  get() {
    const value = this.getAttribute("rules");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("rules", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "summary", {
  get() {
    const value = this.getAttribute("summary");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("summary", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "width", {
  get() {
    const value = this.getAttribute("width");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("width", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "bgColor", {
  get() {
    const value = this.getAttribute("bgColor");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("bgColor", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "cellPadding", {
  get() {
    const value = this.getAttribute("cellPadding");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("cellPadding", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLTableElement.prototype, "cellSpacing", {
  get() {
    const value = this.getAttribute("cellSpacing");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this.setAttribute("cellSpacing", V);
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
    let obj = Object.create(HTMLTableElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTableElement.prototype);
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
  interface: HTMLTableElement,
  expose: {
    Window: { HTMLTableElement: HTMLTableElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLTableElement-impl.js");
