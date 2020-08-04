"use strict";

const parse5 = require("parse5");

const DocumentType = require("../../living/generated/DocumentType");
const DocumentFragment = require("../../living/generated/DocumentFragment");
const Text = require("../../living/generated/Text");
const Comment = require("../../living/generated/Comment");

const attributes = require("../../living/attributes");
const nodeTypes = require("../../living/node-type");

const serializationAdapter = require("../../living/domparsing/parse5-adapter-serialization");

const OpenElementStack = require("parse5/lib/parser/open-element-stack");
const OpenElementStackOriginalPop = OpenElementStack.prototype.pop;
const OpenElementStackOriginalPush = OpenElementStack.prototype.push;

class JSDOMParse5Adapter {
  constructor(documentImpl) {
    this._documentImpl = documentImpl;

    // Since the createElement hook doesn't provide the parent element, we keep track of this using _currentElement:
    // https://github.com/inikulin/parse5/issues/285
    this._currentElement = undefined;

    // Horrible monkey-patch to implement https://github.com/inikulin/parse5/issues/237
    const adapter = this;
    OpenElementStack.prototype.push = function (...args) {
      OpenElementStackOriginalPush.apply(this, args);
      adapter._currentElement = this.current;

      const after = this.items[this.stackTop];
      if (after._pushedOnStackOfOpenElements) {
        after._pushedOnStackOfOpenElements();
      }
    };
    OpenElementStack.prototype.pop = function (...args) {
      const before = this.items[this.stackTop];

      OpenElementStackOriginalPop.apply(this, args);
      adapter._currentElement = this.current;

      if (before._poppedOffStackOfOpenElements) {
        before._poppedOffStackOfOpenElements();
      }
    };
  }

  _ownerDocument() {
    // The _currentElement is undefined when parsing elements at the root of the document. In this case we would
    // fallback to the global _documentImpl.
    return this._currentElement ? this._currentElement._ownerDocument : this._documentImpl;
  }

  createDocument() {
    // parse5's model assumes that parse(html) will call into here to create the new Document, then return it. However,
    // jsdom's model assumes we can create a Window (and through that create an empty Document), do some other setup
    // stuff, and then parse, stuffing nodes into that Document as we go. So to adapt between these two models, we just
    // return the already-created Document when asked by parse5 to "create" a Document.
    return this._documentImpl;
  }

  createDocumentFragment() {
    return DocumentFragment.createImpl([], { ownerDocument: this._currentElement._ownerDocument });
  }

  createElement(localName, namespace, attrs) {
    const ownerDocument = this._ownerDocument();

    const element = ownerDocument._createElementWithCorrectElementInterface(localName, namespace);
    element._namespaceURI = namespace;
    this.adoptAttributes(element, attrs);

    if ("_parserInserted" in element) {
      element._parserInserted = true;
    }

    return element;
  }

  createCommentNode(data) {
    const ownerDocument = this._ownerDocument();
    return Comment.createImpl([], { data, ownerDocument });
  }

  appendChild(parentNode, newNode) {
    parentNode._append(newNode);
  }

  insertBefore(parentNode, newNode, referenceNode) {
    parentNode._insert(newNode, referenceNode);
  }

  setTemplateContent(templateElement, contentFragment) {
    // This code makes the glue between jsdom and parse5 HTMLTemplateElement parsing:
    //
    // * jsdom during the construction of the HTMLTemplateElement (for example when create via
    //   `document.createElement("template")`), creates a DocumentFragment and set it into _templateContents.
    // * parse5 when parsing a <template> tag creates an HTMLTemplateElement (`createElement` adapter hook) and also
    //   create a DocumentFragment (`createDocumentFragment` adapter hook).
    //
    // At this point we now have to replace the one created in jsdom with one created by parse5.
    const { _ownerDocument, _host } = templateElement._templateContents;
    contentFragment._ownerDocument = _ownerDocument;
    contentFragment._host = _host;

    templateElement._templateContents = contentFragment;
  }

  setDocumentType(document, name, publicId, systemId) {
    const ownerDocument = this._ownerDocument();
    const documentType = DocumentType.createImpl([], { name, publicId, systemId, ownerDocument });

    document._append(documentType);
  }

  setDocumentMode(document, mode) {
    // TODO: the rest of jsdom ignores this
    document._mode = mode;
  }

  detachNode(node) {
    node.remove();
  }

  insertText(parentNode, text) {
    const { lastChild } = parentNode;
    if (lastChild && lastChild.nodeType === nodeTypes.TEXT_NODE) {
      lastChild.data += text;
    } else {
      const ownerDocument = this._ownerDocument();
      const textNode = Text.createImpl([], { data: text, ownerDocument });
      parentNode._append(textNode);
    }
  }

  insertTextBefore(parentNode, text, referenceNode) {
    const { previousSibling } = referenceNode;
    if (previousSibling && previousSibling.nodeType === nodeTypes.TEXT_NODE) {
      previousSibling.data += text;
    } else {
      const ownerDocument = this._ownerDocument();
      const textNode = Text.createImpl([], { data: text, ownerDocument });
      parentNode._append(textNode, referenceNode);
    }
  }

  adoptAttributes(element, attrs) {
    for (const attr of attrs) {
      const prefix = attr.prefix === "" ? null : attr.prefix;
      attributes.setAttributeValue(element, attr.name, attr.value, prefix, attr.namespace);
    }
  }
}

// Assign shared adapters with serializer.
Object.assign(JSDOMParse5Adapter.prototype, serializationAdapter);

function parseFragment(markup, contextElement) {
  const ownerDocument = contextElement._ownerDocument;

  const config = Object.assign({}, ownerDocument._parseOptions, {
    treeAdapter: new JSDOMParse5Adapter(ownerDocument)
  });

  return parse5.parseFragment(contextElement, markup, config);
}

function parseIntoDocument(markup, ownerDocument) {
  const config = Object.assign({}, ownerDocument._parseOptions, {
    treeAdapter: new JSDOMParse5Adapter(ownerDocument)
  });

  return parse5.parse(markup, config);
}

module.exports = {
  parseFragment,
  parseIntoDocument
};
