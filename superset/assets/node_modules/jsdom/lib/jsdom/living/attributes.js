"use strict";
const DOMException = require("../web-idl/DOMException");
const defineGetter = require("../utils").defineGetter;
const idlUtils = require("./generated/utils");
const attrGenerated = require("./generated/Attr");
const changeAttributeImpl = require("./attributes/Attr-impl").changeAttributeImpl;
const getAttrImplQualifiedName = require("./attributes/Attr-impl").getAttrImplQualifiedName;

// https://dom.spec.whatwg.org/#namednodemap

const INTERNAL = Symbol("NamedNodeMap internal");

// TODO: use NamedPropertyTracker when https://github.com/tmpvar/jsdom/pull/1116 lands?

// Don't emulate named getters for these properties.
// Compiled later after NamedNodeMap is all set up.
const reservedNames = new Set();

function NamedNodeMap() {
  throw new TypeError("Illegal constructor");
}

defineGetter(NamedNodeMap.prototype, "length", function () {
  return this[INTERNAL].attributeList.length;
});

NamedNodeMap.prototype.item = function (index) {
  if (arguments.length < 1) {
    throw new TypeError("Not enough arguments to NamedNodeMap.prototype.item");
  }

  // Don't bother with full unsigned long long conversion. When we have better WebIDL support generally, revisit.
  index = Number(index);

  return this[index] || null;
};

NamedNodeMap.prototype.getNamedItem = function (name) {
  if (arguments.length < 1) {
    throw new TypeError("Not enough arguments to NamedNodeMap.prototype.getNamedItem");
  }
  name = String(name);

  return idlUtils.wrapperForImpl(exports.getAttributeByName(this[INTERNAL].element, name));
};

NamedNodeMap.prototype.getNamedItemNS = function (namespace, localName) {
  if (arguments.length < 2) {
    throw new TypeError("Not enough arguments to NamedNodeMap.prototype.getNamedItemNS");
  }
  if (namespace === undefined || namespace === null) {
    namespace = null;
  } else {
    namespace = String(namespace);
  }
  localName = String(localName);

  return idlUtils.wrapperForImpl(exports.getAttributeByNameNS(this[INTERNAL].element, namespace, localName));
};

NamedNodeMap.prototype.setNamedItem = function (attr) {
  if (!attrGenerated.is(attr)) {
    throw new TypeError("First argument to NamedNodeMap.prototype.setNamedItem must be an Attr");
  }

  return idlUtils.wrapperForImpl(exports.setAttribute(this[INTERNAL].element, idlUtils.implForWrapper(attr)));
};

NamedNodeMap.prototype.setNamedItemNS = function (attr) {
  if (!attrGenerated.is(attr)) {
    throw new TypeError("First argument to NamedNodeMap.prototype.setNamedItemNS must be an Attr");
  }

  return idlUtils.wrapperForImpl(exports.setAttribute(this[INTERNAL].element, idlUtils.implForWrapper(attr)));
};

NamedNodeMap.prototype.removeNamedItem = function (name) {
  if (arguments.length < 1) {
    throw new TypeError("Not enough arguments to NamedNodeMap.prototype.getNamedItem");
  }
  name = String(name);

  const attr = exports.removeAttributeByName(this[INTERNAL].element, name);

  if (attr === null) {
    throw new DOMException(DOMException.NOT_FOUND_ERR, "Tried to remove an attribute that was not present");
  }

  return idlUtils.wrapperForImpl(attr);
};

NamedNodeMap.prototype.removeNamedItemNS = function (namespace, localName) {
  if (arguments.length < 2) {
    throw new TypeError("Not enough arguments to NamedNodeMap.prototype.removeNamedItemNS");
  }
  if (namespace === undefined || namespace === null) {
    namespace = null;
  } else {
    namespace = String(namespace);
  }
  localName = String(localName);

  const attr = exports.removeAttributeByNameNS(this[INTERNAL].element, namespace, localName);

  if (attr === null) {
    throw new DOMException(DOMException.NOT_FOUND_ERR, "Tried to remove an attribute that was not present");
  }

  return idlUtils.wrapperForImpl(attr);
};

exports.NamedNodeMap = NamedNodeMap;

{
  let prototype = NamedNodeMap.prototype;
  while (prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      reservedNames.add(name);
    }
    prototype = Object.getPrototypeOf(prototype);
  }
}

exports.createNamedNodeMap = function (element) {
  const nnm = Object.create(NamedNodeMap.prototype);
  nnm[INTERNAL] = {
    element,
    attributeList: [],
    attributesByNameMap: new Map()
  };
  return nnm;
};

// The following three are for https://dom.spec.whatwg.org/#concept-element-attribute-has. We don't just have a
// predicate tester since removing that kind of flexibility gives us the potential for better future optimizations.

exports.hasAttribute = function (element, A) {
  const attributesNNM = element._attributes;
  const attributeList = attributesNNM[INTERNAL].attributeList;

  return attributeList.indexOf(A) !== -1;
};

exports.hasAttributeByName = function (element, name) {
  const attributesNNM = element._attributes;
  const attributesByNameMap = attributesNNM[INTERNAL].attributesByNameMap;

  return attributesByNameMap.has(name);
};

exports.hasAttributeByNameNS = function (element, namespace, localName) {
  const attributesNNM = element._attributes;
  const attributeList = attributesNNM[INTERNAL].attributeList;

  return attributeList.some(attribute => {
    return attribute._localName === localName && attribute._namespace === namespace;
  });
};

exports.changeAttribute = function (element, attribute, value) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-change

  // The partitioning here works around a particularly bad circular require problem. See
  // https://github.com/tmpvar/jsdom/pull/1247#issuecomment-149060470
  changeAttributeImpl(element, attribute, value);
};

exports.appendAttribute = function (element, attribute) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-append

  const attributesNNM = element._attributes;
  const attributeList = attributesNNM[INTERNAL].attributeList;

  // TODO mutation observer stuff

  attributeList.push(attribute);
  attribute._element = element;

  // Sync target indexed properties
  attributesNNM[attributeList.length - 1] = idlUtils.wrapperForImpl(attribute);

  const name = getAttrImplQualifiedName(attribute);

  // Sync target named properties
  if (!reservedNames.has(name) && shouldNameBeInNNMProps(element, name)) {
    Object.defineProperty(attributesNNM, name, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: idlUtils.wrapperForImpl(attribute)
    });
  }

  // Sync name cache
  const cache = attributesNNM[INTERNAL].attributesByNameMap;
  let entry = cache.get(name);
  if (!entry) {
    entry = [];
    cache.set(name, entry);
  }
  entry.push(attribute);

  // Run jsdom hooks; roughly correspond to spec's "An attribute is set and an attribute is added."
  element._attrModified(name, attribute._value, null);
};

exports.removeAttribute = function (element, attribute) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-remove

  const attributesNNM = element._attributes;
  const attributeList = attributesNNM[INTERNAL].attributeList;

  // TODO mutation observer stuff

  for (let i = 0; i < attributeList.length; ++i) {
    if (attributeList[i] === attribute) {
      attributeList.splice(i, 1);
      attribute._element = null;

      // Sync target indexed properties
      for (let j = i; j < attributeList.length; ++j) {
        attributesNNM[j] = idlUtils.wrapperForImpl(attributeList[j]);
      }
      delete attributesNNM[attributeList.length];

      const name = getAttrImplQualifiedName(attribute);

      // Sync target named properties
      if (!reservedNames.has(name) && shouldNameBeInNNMProps(element, name)) {
        delete attributesNNM[name];
      }

      // Sync name cache
      const cache = attributesNNM[INTERNAL].attributesByNameMap;
      const entry = cache.get(name);
      entry.splice(entry.indexOf(attribute), 1);
      if (entry.length === 0) {
        cache.delete(name);
      }

      // Run jsdom hooks; roughly correspond to spec's "An attribute is removed."
      element._attrModified(name, null, attribute._value);

      return;
    }
  }
};

exports.replaceAttribute = function (element, oldAttr, newAttr) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-replace

  const attributesNNM = element._attributes;
  const attributeList = attributesNNM[INTERNAL].attributeList;

  // TODO mutation observer stuff

  for (let i = 0; i < attributeList.length; ++i) {
    if (attributeList[i] === oldAttr) {
      attributeList.splice(i, 1, newAttr);
      oldAttr._element = null;
      newAttr._element = element;

      // Sync target indexed properties
      attributesNNM[i] = idlUtils.wrapperForImpl(newAttr);

      const name = getAttrImplQualifiedName(newAttr);

      // Sync target named properties
      if (!reservedNames.has(name) && shouldNameBeInNNMProps(element, name)) {
        attributesNNM[name] = newAttr;
      }

      // Sync name cache
      const cache = attributesNNM[INTERNAL].attributesByNameMap;
      let entry = cache.get(name);
      if (!entry) {
        entry = [];
        cache.set(name, entry);
      }
      entry.splice(entry.indexOf(oldAttr), 1, newAttr);

      // Run jsdom hooks; roughly correspond to spec's "An attribute is set and an attribute is changed."
      element._attrModified(name, newAttr._value, oldAttr._value);

      return;
    }
  }
};

exports.getAttributeByName = function (element, name) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-get-by-name

  if (element._namespaceURI === "http://www.w3.org/1999/xhtml" &&
      element._ownerDocument._parsingMode === "html") {
    name = name.toLowerCase();
  }

  const cache = element._attributes[INTERNAL].attributesByNameMap;
  const entry = cache.get(name);
  if (!entry) {
    return null;
  }

  return entry[0];
};

exports.getAttributeValue = function (element, name) {
  const attr = exports.getAttributeByName(element, name);

  if (!attr) {
    return null;
  }

  return attr._value;
};

exports.getAttributeByNameNS = function (element, namespace, localName) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-get-by-namespace

  if (namespace === "") {
    namespace = null;
  }

  const attributeList = element._attributes[INTERNAL].attributeList;
  for (let i = 0; i < attributeList.length; ++i) {
    const attr = attributeList[i];
    if (attr._namespace === namespace && attr._localName === localName) {
      return attr;
    }
  }

  return null;
};

exports.getAttributeValueByNameNS = function (element, namespace, localName) {
  const attr = exports.getAttributeByNameNS(element, namespace, localName);

  if (!attr) {
    return null;
  }

  return attr._value;
};

exports.setAttribute = function (element, attr) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-set

  if (attr._element !== null && attr._element !== element) {
    throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
  }

  const oldAttr = exports.getAttributeByNameNS(element, attr._namespace, attr._localName);
  if (oldAttr === attr) {
    return attr;
  }

  if (oldAttr !== null) {
    exports.replaceAttribute(element, oldAttr, attr);
  } else {
    exports.appendAttribute(element, attr);
  }

  return oldAttr;
};

exports.setAttributeValue = function (element, localName, value, prefix, namespace) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-set-value

  if (prefix === undefined) {
    prefix = null;
  }
  if (namespace === undefined) {
    namespace = null;
  }

  const attribute = exports.getAttributeByNameNS(element, namespace, localName);
  if (attribute === null) {
    const newAttribute = attrGenerated.createImpl([], { namespace, namespacePrefix: prefix, localName, value });
    exports.appendAttribute(element, newAttribute);
    return;
  }

  exports.changeAttribute(element, attribute, value);
};

exports.removeAttributeByName = function (element, name) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-name

  const attr = exports.getAttributeByName(element, name);

  if (attr !== null) {
    exports.removeAttribute(element, attr);
  }

  return attr;
};

exports.removeAttributeByNameNS = function (element, namespace, localName) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-namespace

  const attr = exports.getAttributeByNameNS(element, namespace, localName);

  if (attr !== null) {
    exports.removeAttribute(element, attr);
  }

  return attr;
};

exports.copyAttributeList = function (sourceElement, destElement) {
  // Needed by https://dom.spec.whatwg.org/#concept-node-clone

  for (const sourceAttr of sourceElement._attributes[INTERNAL].attributeList) {
    const destAttr = attrGenerated.createImpl([], {
      namespace: sourceAttr._namespace,
      namespacePrefix: sourceAttr._namespacePrefix,
      localName: sourceAttr._localName,
      value: sourceAttr._value
    });

    exports.appendAttribute(destElement, destAttr);
  }
};

exports.attributeListsEqual = function (elementA, elementB) {
  // Needed by https://dom.spec.whatwg.org/#concept-node-equals

  const listA = elementA._attributes[INTERNAL].attributeList;
  const listB = elementB._attributes[INTERNAL].attributeList;

  if (listA.length !== listB.length) {
    return false;
  }

  for (let i = 0; i < listA.length; ++i) {
    const attrA = listA[i];

    if (!listB.some(attrB => equalsA(attrB))) {
      return false;
    }

    function equalsA(attrB) {
      return attrA._namespace === attrB._namespace && attrA._localName === attrB._localName &&
             attrA._value === attrB._value;
    }
  }

  return true;
};

exports.attributeNames = function (element) {
  // Needed by https://dom.spec.whatwg.org/#dom-element-getattributenames

  return element._attributes[INTERNAL].attributeList.map(getAttrImplQualifiedName);
};

exports.hasAttributes = function (element) {
  // Needed by https://dom.spec.whatwg.org/#dom-element-hasattributes

  return element._attributes[INTERNAL].attributeList.length > 0;
};

function shouldNameBeInNNMProps(element, name) {
  if (element._ownerDocument._parsingMode === "html" && element._namespaceURI === "http://www.w3.org/1999/xhtml") {
    return name.toLowerCase() === name;
  }
  return true;
}
