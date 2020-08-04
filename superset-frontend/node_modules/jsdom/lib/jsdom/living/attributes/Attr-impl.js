"use strict";

exports.implementation = class AttrImpl {
  constructor(_, privateData) {
    this._namespace = privateData.namespace !== undefined ? privateData.namespace : null;
    this._namespacePrefix = privateData.namespacePrefix !== undefined ? privateData.namespacePrefix : null;
    this._localName = privateData.localName;
    this._value = privateData.value !== undefined ? privateData.value : "";
    this._element = privateData.element !== undefined ? privateData.element : null;

    this.specified = true;
  }

  get namespaceURI() {
    return this._namespace;
  }

  get prefix() {
    return this._namespacePrefix;
  }

  get localName() {
    return this._localName;
  }

  get name() {
    return exports.getAttrImplQualifiedName(this);
  }

  // Delegate to name
  get nodeName() {
    return this.name;
  }

  get value() {
    return this._value;
  }
  set value(v) {
    if (this._element === null) {
      this._value = v;
    } else {
      exports.changeAttributeImpl(this._element, this, v);
    }
  }

  // Delegate to value
  get nodeValue() {
    return this.value;
  }
  set nodeValue(v) {
    this.value = v;
  }

  // Delegate to value
  get textContent() {
    return this.value;
  }
  set textContent(v) {
    this.value = v;
  }

  get ownerElement() {
    return this._element;
  }
};

exports.changeAttributeImpl = function (element, attributeImpl, value) {
  // https://dom.spec.whatwg.org/#concept-element-attributes-change

  // TODO mutation observer stuff

  const oldValue = attributeImpl._value;
  attributeImpl._value = value;

  // Run jsdom hooks; roughly correspond to spec's "An attribute is set and an attribute is changed."
  element._attrModified(exports.getAttrImplQualifiedName(attributeImpl), value, oldValue);
};

exports.getAttrImplQualifiedName = function (attributeImpl) {
  // https://dom.spec.whatwg.org/#concept-attribute-qualified-name

  if (attributeImpl._namespacePrefix === null) {
    return attributeImpl._localName;
  }

  return attributeImpl._namespacePrefix + ":" + attributeImpl._localName;
};
