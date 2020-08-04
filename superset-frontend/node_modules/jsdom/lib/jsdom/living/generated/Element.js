"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const Node = require("./Node.js");
const impl = utils.implSymbol;
const mixin = utils.mixin;
const ChildNode = require("./ChildNode.js");
const NonDocumentTypeChildNode = require("./NonDocumentTypeChildNode.js");
const ParentNode = require("./ParentNode.js");

function Element() {
  throw new TypeError("Illegal constructor");
}
Element.prototype = Object.create(Node.interface.prototype);
Element.prototype.constructor = Element;

mixin(Element.prototype, ChildNode.interface.prototype);
ChildNode.mixedInto.push(Element);
mixin(Element.prototype, NonDocumentTypeChildNode.interface.prototype);
NonDocumentTypeChildNode.mixedInto.push(Element);
mixin(Element.prototype, ParentNode.interface.prototype);
ParentNode.mixedInto.push(Element);

Element.prototype.hasAttributes = function hasAttributes() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].hasAttributes.apply(this[impl], args);
};

Element.prototype.getAttributeNames = function getAttributeNames() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].getAttributeNames.apply(this[impl], args));
};

Element.prototype.getAttribute = function getAttribute(qualifiedName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getAttribute' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].getAttribute.apply(this[impl], args);
};

Element.prototype.getAttributeNS = function getAttributeNS(namespace, localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'getAttributeNS' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].getAttributeNS.apply(this[impl], args);
};

Element.prototype.setAttribute = function setAttribute(qualifiedName, value) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'setAttribute' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].setAttribute.apply(this[impl], args);
};

Element.prototype.setAttributeNS = function setAttributeNS(namespace, qualifiedName, value) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 3) {
    throw new TypeError("Failed to execute 'setAttributeNS' on 'Element': 3 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  args[2] = conversions["DOMString"](args[2]);
  return this[impl].setAttributeNS.apply(this[impl], args);
};

Element.prototype.removeAttribute = function removeAttribute(qualifiedName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'removeAttribute' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].removeAttribute.apply(this[impl], args);
};

Element.prototype.removeAttributeNS = function removeAttributeNS(namespace, localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'removeAttributeNS' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].removeAttributeNS.apply(this[impl], args);
};

Element.prototype.hasAttribute = function hasAttribute(qualifiedName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'hasAttribute' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].hasAttribute.apply(this[impl], args);
};

Element.prototype.hasAttributeNS = function hasAttributeNS(namespace, localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'hasAttributeNS' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].hasAttributeNS.apply(this[impl], args);
};

Element.prototype.getAttributeNode = function getAttributeNode(qualifiedName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getAttributeNode' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return utils.tryWrapperForImpl(this[impl].getAttributeNode.apply(this[impl], args));
};

Element.prototype.getAttributeNodeNS = function getAttributeNodeNS(namespace, localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'getAttributeNodeNS' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  return utils.tryWrapperForImpl(this[impl].getAttributeNodeNS.apply(this[impl], args));
};

Element.prototype.setAttributeNode = function setAttributeNode(attr) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'setAttributeNode' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].setAttributeNode.apply(this[impl], args));
};

Element.prototype.setAttributeNodeNS = function setAttributeNodeNS(attr) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'setAttributeNodeNS' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].setAttributeNodeNS.apply(this[impl], args));
};

Element.prototype.removeAttributeNode = function removeAttributeNode(attr) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'removeAttributeNode' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].removeAttributeNode.apply(this[impl], args));
};

Element.prototype.matches = function matches(selectors) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'matches' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].matches.apply(this[impl], args);
};

Element.prototype.webkitMatchesSelector = function webkitMatchesSelector(selectors) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'webkitMatchesSelector' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return this[impl].webkitMatchesSelector.apply(this[impl], args);
};

Element.prototype.getElementsByTagName = function getElementsByTagName(localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getElementsByTagName' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return utils.tryWrapperForImpl(this[impl].getElementsByTagName.apply(this[impl], args));
};

Element.prototype.getElementsByTagNameNS = function getElementsByTagNameNS(namespace, localName) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'getElementsByTagNameNS' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] === null || args[0] === undefined) {
    args[0] = null;
  } else {
  args[0] = conversions["DOMString"](args[0]);
  }
  args[1] = conversions["DOMString"](args[1]);
  return utils.tryWrapperForImpl(this[impl].getElementsByTagNameNS.apply(this[impl], args));
};

Element.prototype.getElementsByClassName = function getElementsByClassName(classNames) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'getElementsByClassName' on 'Element': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return utils.tryWrapperForImpl(this[impl].getElementsByClassName.apply(this[impl], args));
};

Element.prototype.insertAdjacentHTML = function insertAdjacentHTML(position, text) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 2) {
    throw new TypeError("Failed to execute 'insertAdjacentHTML' on 'Element': 2 arguments required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  args[1] = conversions["DOMString"](args[1]);
  return this[impl].insertAdjacentHTML.apply(this[impl], args);
};

Element.prototype.getClientRects = function getClientRects() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].getClientRects.apply(this[impl], args));
};

Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return utils.tryWrapperForImpl(this[impl].getBoundingClientRect.apply(this[impl], args));
};

Element.prototype.toString = function () {
  if (this === Element.prototype) {
    return "[object ElementPrototype]";
  }
  return Node.interface.prototype.toString.call(this);
};
Object.defineProperty(Element.prototype, "namespaceURI", {
  get() {
    return this[impl].namespaceURI;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "prefix", {
  get() {
    return this[impl].prefix;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "localName", {
  get() {
    return this[impl].localName;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "tagName", {
  get() {
    return this[impl].tagName;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "id", {
  get() {
    const value = this.getAttribute("id");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("id", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "className", {
  get() {
    const value = this.getAttribute("class");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("class", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "classList", {
  get() {
    return utils.tryWrapperForImpl(this[impl].classList);
  },
  set(V) {
    this.classList.value = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "attributes", {
  get() {
    return utils.tryWrapperForImpl(this[impl].attributes);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "innerHTML", {
  get() {
    return this[impl].innerHTML;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this[impl].innerHTML = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "outerHTML", {
  get() {
    return this[impl].outerHTML;
  },
  set(V) {
    V = conversions["DOMString"](V, { treatNullAsEmptyString: true });
    this[impl].outerHTML = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "scrollTop", {
  get() {
    return this[impl].scrollTop;
  },
  set(V) {
    V = conversions["unrestricted double"](V);
    this[impl].scrollTop = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "scrollLeft", {
  get() {
    return this[impl].scrollLeft;
  },
  set(V) {
    V = conversions["unrestricted double"](V);
    this[impl].scrollLeft = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "scrollWidth", {
  get() {
    return this[impl].scrollWidth;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "scrollHeight", {
  get() {
    return this[impl].scrollHeight;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "clientTop", {
  get() {
    return this[impl].clientTop;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "clientLeft", {
  get() {
    return this[impl].clientLeft;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "clientWidth", {
  get() {
    return this[impl].clientWidth;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(Element.prototype, "clientHeight", {
  get() {
    return this[impl].clientHeight;
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
    let obj = Object.create(Element.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Element.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    Node._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: Element,
  expose: {
    Window: { Element: Element }
  }
};
module.exports = iface;

const Impl = require("../nodes/Element-impl.js");
