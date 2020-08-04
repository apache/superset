"use strict";
const vm = require("vm");
const nwmatcher = require("nwmatcher/src/nwmatcher-noqsa");
const idlUtils = require("../generated/utils");
const NodeImpl = require("./Node-impl").implementation;
const ParentNodeImpl = require("./ParentNode-impl").implementation;
const ChildNodeImpl = require("./ChildNode-impl").implementation;
const attributes = require("../attributes");
const namedPropertiesWindow = require("../named-properties-window");
const NODE_TYPE = require("../node-type");
const domToHtml = require("../../browser/domtohtml").domToHtml;
const memoizeQuery = require("../../utils").memoizeQuery;
const clone = require("../node").clone;
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const resetDOMTokenList = require("../dom-token-list").reset;
const DOMException = require("../../web-idl/DOMException");
const createDOMTokenList = require("../dom-token-list").create;
const attrGenerated = require("../generated/Attr");
const validateNames = require("../helpers/validate-names");
const listOfElementsWithQualifiedName = require("../node").listOfElementsWithQualifiedName;
const listOfElementsWithNamespaceAndLocalName = require("../node").listOfElementsWithNamespaceAndLocalName;
const listOfElementsWithClassNames = require("../node").listOfElementsWithClassNames;
const proxiedWindowEventHandlers = require("../helpers/proxied-window-event-handlers");
const NonDocumentTypeChildNode = require("./NonDocumentTypeChildNode-impl").implementation;

// nwmatcher gets `document.documentElement` at creation-time, so we have to initialize lazily, since in the initial
// stages of Document initialization, there is no documentElement present yet.
function addNwmatcher(parentNode) {
  const document = parentNode._ownerDocument;

  if (!document._nwmatcher) {
    document._nwmatcher = nwmatcher({ document });
    document._nwmatcher.configure({ UNIQUE_ID: false });
  }

  return document._nwmatcher;
}

function clearChildNodes(node) {
  for (let child = domSymbolTree.firstChild(node); child; child = domSymbolTree.firstChild(node)) {
    node.removeChild(child);
  }
}

function setInnerHTML(document, node, html) {
  // Clear the children first:
  if (node._templateContents) {
    clearChildNodes(node._templateContents);
  } else {
    clearChildNodes(node);
  }

  if (html !== "") {
    if (node.nodeName === "#document") {
      document._htmlToDom.appendHtmlToDocument(html, node);
    } else {
      document._htmlToDom.appendHtmlToElement(html, node);
    }
  }
}

function attachId(id, elm, doc) {
  if (id && elm && doc) {
    if (!doc._ids[id]) {
      doc._ids[id] = [];
    }
    doc._ids[id].push(elm);
  }
}

function detachId(id, elm, doc) {
  if (id && elm && doc) {
    if (doc._ids && doc._ids[id]) {
      const elms = doc._ids[id];
      for (let i = 0; i < elms.length; i++) {
        if (elms[i] === elm) {
          elms.splice(i, 1);
          --i;
        }
      }
      if (elms.length === 0) {
        delete doc._ids[id];
      }
    }
  }
}

class ElementImpl extends NodeImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this.nodeType = NODE_TYPE.ELEMENT_NODE;
    this.scrollTop = 0;
    this.scrollLeft = 0;

    this._namespaceURI = null;
    this._prefix = null;
    this._localName = privateData.localName;
    this._attributes = attributes.createNamedNodeMap(this);
  }

  _attach() {
    namedPropertiesWindow.nodeAttachedToDocument(this);

    const id = this.getAttribute("id");
    if (id) {
      attachId(id, this, this._ownerDocument);
    }

    super._attach();
  }

  _detach() {
    super._detach();

    namedPropertiesWindow.nodeDetachedFromDocument(this);

    const id = this.getAttribute("id");
    if (id) {
      detachId(id, this, this._ownerDocument);
    }
  }

  _attrModified(name, value, oldValue) {
    this._modified();
    namedPropertiesWindow.elementAttributeModified(this, name, value, oldValue);

    if (name === "id" && this._attached) {
      const doc = this._ownerDocument;
      detachId(oldValue, this, doc);
      attachId(value, this, doc);
    }

    const w = this._ownerDocument._global;

    // TODO event handlers:
    // The correct way to do this is lazy, and a bit more complicated; see
    // https://html.spec.whatwg.org/multipage/webappapis.html#event-handler-content-attributes
    // It would only be possible if we had proper getters/setters for every event handler, which we don't right now.
    if (name.length > 2 && name[0] === "o" && name[1] === "n") {
      // If this document does not have a window, set IDL attribute to null
      // step 2: https://html.spec.whatwg.org/multipage/webappapis.html#getting-the-current-value-of-the-event-handler
      if (value && w) {
        const self = proxiedWindowEventHandlers.has(name) && this._localName === "body" ? w : this;
        const vmOptions = { filename: this._ownerDocument.URL, displayErrors: false };

        // The handler code probably refers to functions declared globally on the window, so we need to run it in
        // that context. In fact, it's worse; see
        // https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/bindings/core/v8/V8LazyEventListener.cpp
        // plus the spec, which show how multiple nested scopes are technically required. We won't implement that
        // until someone asks for it, though.

        // https://html.spec.whatwg.org/multipage/webappapis.html#the-event-handler-processing-algorithm

        if (name === "onerror" && self === w) {
          // https://html.spec.whatwg.org/multipage/webappapis.html#getting-the-current-value-of-the-event-handler
          // step 10

          self[name] = function (event, source, lineno, colno, error) {
            w.__tempEventHandlerThis = this;
            w.__tempEventHandlerEvent = event;
            w.__tempEventHandlerSource = source;
            w.__tempEventHandlerLineno = lineno;
            w.__tempEventHandlerColno = colno;
            w.__tempEventHandlerError = error;

            try {
              return vm.runInContext(`
                (function (event, source, lineno, colno, error) {
                  ${value}
                }).call(__tempEventHandlerThis, __tempEventHandlerEvent, __tempEventHandlerSource,
                        __tempEventHandlerLineno, __tempEventHandlerColno, __tempEventHandlerError)`, w, vmOptions);
            } finally {
              delete w.__tempEventHandlerThis;
              delete w.__tempEventHandlerEvent;
              delete w.__tempEventHandlerSource;
              delete w.__tempEventHandlerLineno;
              delete w.__tempEventHandlerColno;
              delete w.__tempEventHandlerError;
            }
          };
        } else {
          self[name] = function (event) {
            w.__tempEventHandlerThis = this;
            w.__tempEventHandlerEvent = event;

            try {
              return vm.runInContext(`
                (function (event) {
                  ${value}
                }).call(__tempEventHandlerThis, __tempEventHandlerEvent)`, w, vmOptions);
            } finally {
              delete w.__tempEventHandlerThis;
              delete w.__tempEventHandlerEvent;
            }
          };
        }
      } else {
        this[name] = null;
      }
    }

    // update classList
    if (name === "class") {
      resetDOMTokenList(this.classList, value);
    }
  }

  get namespaceURI() {
    return this._namespaceURI;
  }
  get prefix() {
    return this._prefix;
  }
  get localName() {
    return this._localName;
  }
  get _qualifiedName() {
    return this._prefix !== null ? this._prefix + ":" + this._localName : this._localName;
  }
  get tagName() {
    let qualifiedName = this._qualifiedName;
    if (this.namespaceURI === "http://www.w3.org/1999/xhtml" && this._ownerDocument._parsingMode === "html") {
      qualifiedName = qualifiedName.toUpperCase();
    }
    return qualifiedName;
  }

  get attributes() {
    return this._attributes;
  }

  get outerHTML() {
    return domToHtml([this]);
  }

  set outerHTML(html) {
    if (html === null) {
      html = "";
    }

    const parent = domSymbolTree.parent(this);
    const document = this._ownerDocument;

    if (!parent) {
      return;
    }

    let contextElement;
    if (parent.nodeType === NODE_TYPE.DOCUMENT_NODE) {
      throw new DOMException(DOMException.NO_MODIFICATION_ALLOWED_ERR,
                                  "Modifications are not allowed for this document");
    } else if (parent.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE) {
      contextElement = document.createElementNS("http://www.w3.org/1999/xhtml", "body");
    } else if (parent.nodeType === NODE_TYPE.ELEMENT_NODE) {
      contextElement = clone(this._core, parent, undefined, false);
    } else {
      throw new TypeError("This should never happen");
    }

    document._htmlToDom.appendHtmlToElement(html, contextElement);

    while (contextElement.firstChild) {
      parent.insertBefore(contextElement.firstChild, this);
    }

    parent.removeChild(this);
  }

  get innerHTML() {
    const tagName = this.tagName;
    if (tagName === "SCRIPT" || tagName === "STYLE") {
      const type = this.getAttribute("type");
      if (!type || /^text\//i.test(type) || /\/javascript$/i.test(type)) {
        return domToHtml(domSymbolTree.childrenIterator(this));
      }
    }

    // In case of <template> we should pass its "template contents" fragment as a serialization root if we have one
    if (this._templateContents) {
      return domToHtml(domSymbolTree.childrenIterator(this._templateContents));
    }

    return domToHtml(domSymbolTree.childrenIterator(this));
  }

  set innerHTML(html) {
    if (html === null) {
      html = "";
    }

    setInnerHTML(this.ownerDocument, this, html);
  }

  get classList() {
    if (this._classList === undefined) {
      this._classList = createDOMTokenList(this, "class");
    }
    return this._classList;
  }

  hasAttributes() {
    return attributes.hasAttributes(this);
  }

  getAttributeNames() {
    return attributes.attributeNames(this);
  }

  getAttribute(name) {
    return attributes.getAttributeValue(this, name);
  }

  getAttributeNS(namespace, localName) {
    return attributes.getAttributeValueByNameNS(this, namespace, localName);
  }

  setAttribute(name, value) {
    validateNames.name(name);

    if (this._namespaceURI === "http://www.w3.org/1999/xhtml" && this._ownerDocument._parsingMode === "html") {
      name = name.toLowerCase();
    }

    const attribute = attributes.getAttributeByName(this, name);

    if (attribute === null) {
      const newAttr = attrGenerated.createImpl([], { localName: name, value });
      attributes.appendAttribute(this, newAttr);
      return;
    }

    attributes.changeAttribute(this, attribute, value);
  }

  setAttributeNS(namespace, name, value) {
    const extracted = validateNames.validateAndExtract(namespace, name);

    attributes.setAttributeValue(this, extracted.localName, value, extracted.prefix, extracted.namespace);
  }

  removeAttribute(name) {
    attributes.removeAttributeByName(this, name);
  }

  removeAttributeNS(namespace, localName) {
    attributes.removeAttributeByNameNS(this, namespace, localName);
  }

  hasAttribute(name) {
    if (this._namespaceURI === "http://www.w3.org/1999/xhtml" && this._ownerDocument._parsingMode === "html") {
      name = name.toLowerCase();
    }

    return attributes.hasAttributeByName(this, name);
  }

  hasAttributeNS(namespace, localName) {
    if (namespace === "") {
      namespace = null;
    }

    return attributes.hasAttributeByNameNS(this, namespace, localName);
  }

  getAttributeNode(name) {
    return attributes.getAttributeByName(this, name);
  }

  getAttributeNodeNS(namespace, localName) {
    return attributes.getAttributeByNameNS(this, namespace, localName);
  }

  setAttributeNode(attr) {
    if (!attrGenerated.isImpl(attr)) {
      throw new TypeError("First argument to Element.prototype.setAttributeNode must be an Attr");
    }

    return attributes.setAttribute(this, attr);
  }

  setAttributeNodeNS(attr) {
    if (!attrGenerated.isImpl(attr)) {
      throw new TypeError("First argument to Element.prototype.setAttributeNodeNS must be an Attr");
    }

    return attributes.setAttribute(this, attr);
  }

  removeAttributeNode(attr) {
    if (!attrGenerated.isImpl(attr)) {
      throw new TypeError("First argument to Element.prototype.removeAttributeNode must be an Attr");
    }

    if (!attributes.hasAttribute(this, attr)) {
      throw new DOMException(DOMException.NOT_FOUND_ERR, "Tried to remove an attribute that was not present");
    }

    attributes.removeAttribute(this, attr);

    return attr;
  }

  getBoundingClientRect() {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0
    };
  }

  getClientRects() {
    return [];
  }

  get scrollWidth() {
    return 0;
  }

  get scrollHeight() {
    return 0;
  }

  get clientTop() {
    return 0;
  }

  get clientLeft() {
    return 0;
  }

  get clientWidth() {
    return 0;
  }

  get clientHeight() {
    return 0;
  }

  // https://w3c.github.io/DOM-Parsing/#dom-element-insertadjacenthtml
  insertAdjacentHTML(position, text) {
    position = position.toLowerCase();

    let context;
    switch (position) {
      case "beforebegin":
      case "afterend": {
        context = this.parentNode;
        if (context === null || context.nodeType === NODE_TYPE.DOCUMENT_NODE) {
          throw new DOMException(DOMException.NO_MODIFICATION_ALLOWED_ERR, "Cannot insert HTML adjacent to " +
            "parent-less nodes or children of document nodes.");
        }
        break;
      }
      case "afterbegin":
      case "beforeend": {
        context = this;
        break;
      }
      default: {
        throw new DOMException(DOMException.SYNTAX_ERR, "Must provide one of \"beforebegin\", \"afterend\", " +
          "\"afterbegin\", or \"beforeend\".");
      }
    }

    // TODO: use context for parsing instead of a <template>.
    const fragment = this.ownerDocument.createElement("template");
    fragment.innerHTML = text;

    switch (position) {
      case "beforebegin": {
        this.parentNode.insertBefore(fragment.content, this);
        break;
      }
      case "afterbegin": {
        this.insertBefore(fragment.content, this.firstChild);
        break;
      }
      case "beforeend": {
        this.appendChild(fragment.content);
        break;
      }
      case "afterend": {
        this.parentNode.insertBefore(fragment.content, this.nextSibling);
        break;
      }
    }
  }
}

idlUtils.mixin(ElementImpl.prototype, NonDocumentTypeChildNode.prototype);
idlUtils.mixin(ElementImpl.prototype, ParentNodeImpl.prototype);
idlUtils.mixin(ElementImpl.prototype, ChildNodeImpl.prototype);

ElementImpl.prototype.getElementsByTagName = memoizeQuery(function (qualifiedName) {
  return listOfElementsWithQualifiedName(qualifiedName, this);
});

ElementImpl.prototype.getElementsByTagNameNS = memoizeQuery(function (namespace, localName) {
  return listOfElementsWithNamespaceAndLocalName(namespace, localName, this);
});

ElementImpl.prototype.getElementsByClassName = memoizeQuery(function (classNames) {
  return listOfElementsWithClassNames(classNames, this);
});

ElementImpl.prototype.matches = memoizeQuery(function (selectors) {
  const matcher = addNwmatcher(this);

  try {
    return matcher.match(idlUtils.wrapperForImpl(this), selectors);
  } catch (e) {
    throw new DOMException(DOMException.SYNTAX_ERR, e.message);
  }
});

ElementImpl.prototype.webkitMatchesSelector = ElementImpl.prototype.matches;

module.exports = {
  implementation: ElementImpl
};
