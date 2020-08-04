"use strict";

const { CookieJar } = require("tough-cookie");

const NodeImpl = require("./Node-impl").implementation;
const idlUtils = require("../generated/utils");
const NODE_TYPE = require("../node-type");
const { mixin, memoizeQuery } = require("../../utils");
const { firstChildWithLocalName, firstChildWithLocalNames, firstDescendantWithLocalName } =
  require("../helpers/traversal");
const whatwgURL = require("whatwg-url");
const { StyleSheetList } = require("../../level2/style");
const { domSymbolTree } = require("../helpers/internal-constants");
const eventAccessors = require("../helpers/create-event-accessor");
const { asciiLowercase, stripAndCollapseASCIIWhitespace } = require("../helpers/strings");
const { childTextContent } = require("../helpers/text");
const { HTML_NS, SVG_NS } = require("../helpers/namespaces");
const DOMException = require("domexception");
const { parseIntoDocument } = require("../../browser/parser");
const History = require("../generated/History");
const Location = require("../generated/Location");
const HTMLCollection = require("../generated/HTMLCollection");
const NodeList = require("../generated/NodeList");
const validateName = require("../helpers/validate-names").name;
const { validateAndExtract } = require("../helpers/validate-names");
const { fireAnEvent } = require("../helpers/events");
const { shadowIncludingInclusiveDescendantsIterator } = require("../helpers/shadow-dom");

const DocumentOrShadowRootImpl = require("./DocumentOrShadowRoot-impl").implementation;
const GlobalEventHandlersImpl = require("./GlobalEventHandlers-impl").implementation;
const NonElementParentNodeImpl = require("./NonElementParentNode-impl").implementation;
const ParentNodeImpl = require("./ParentNode-impl").implementation;

const { clone, listOfElementsWithQualifiedName, listOfElementsWithNamespaceAndLocalName,
  listOfElementsWithClassNames } = require("../node");
const generatedAttr = require("../generated/Attr");
const Comment = require("../generated/Comment");
const ProcessingInstruction = require("../generated/ProcessingInstruction");
const CDATASection = require("../generated/CDATASection");
const Text = require("../generated/Text");
const DocumentFragment = require("../generated/DocumentFragment");
const DOMImplementation = require("../generated/DOMImplementation");
const Element = require("../generated/Element");
const HTMLUnknownElement = require("../generated/HTMLUnknownElement");
const SVGElement = require("../generated/SVGElement");
const TreeWalker = require("../generated/TreeWalker");
const NodeIterator = require("../generated/NodeIterator");
const ShadowRoot = require("../generated/ShadowRoot");

const CustomEvent = require("../generated/CustomEvent");
const ErrorEvent = require("../generated/ErrorEvent");
const Event = require("../generated/Event");
const FocusEvent = require("../generated/FocusEvent");
const HashChangeEvent = require("../generated/HashChangeEvent");
const KeyboardEvent = require("../generated/KeyboardEvent");
const MessageEvent = require("../generated/MessageEvent");
const MouseEvent = require("../generated/MouseEvent");
const PopStateEvent = require("../generated/PopStateEvent");
const ProgressEvent = require("../generated/ProgressEvent");
const TouchEvent = require("../generated/TouchEvent");
const UIEvent = require("../generated/UIEvent");

const RequestManager = require("../../browser/resources/request-manager");
const AsyncResourceQueue = require("../../browser/resources/async-resource-queue");
const ResourceQueue = require("../../browser/resources/resource-queue");
const PerDocumentResourceLoader = require("../../browser/resources/per-document-resource-loader");

function clearChildNodes(node) {
  for (let child = domSymbolTree.firstChild(node); child; child = domSymbolTree.firstChild(node)) {
    node.removeChild(child);
  }
}

function pad(number) {
  if (number < 10) {
    return "0" + number;
  }
  return number;
}

function toLastModifiedString(date) {
  return pad(date.getMonth() + 1) +
    "/" + pad(date.getDate()) +
    "/" + date.getFullYear() +
    " " + pad(date.getHours()) +
    ":" + pad(date.getMinutes()) +
    ":" + pad(date.getSeconds());
}

const eventInterfaceTable = {
  customevent: CustomEvent,
  errorevent: ErrorEvent,
  event: Event,
  events: Event,
  focusevent: FocusEvent,
  hashchangeevent: HashChangeEvent,
  htmlevents: Event,
  keyboardevent: KeyboardEvent,
  messageevent: MessageEvent,
  mouseevent: MouseEvent,
  mouseevents: MouseEvent,
  popstateevent: PopStateEvent,
  progressevent: ProgressEvent,
  svgevents: Event,
  touchevent: TouchEvent,
  uievent: UIEvent,
  uievents: UIEvent
};

class DocumentImpl extends NodeImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this._initGlobalEvents();

    this._ownerDocument = this;
    this.nodeType = NODE_TYPE.DOCUMENT_NODE;
    if (!privateData.options) {
      privateData.options = {};
    }
    if (!privateData.options.parsingMode) {
      privateData.options.parsingMode = "xml";
    }
    if (!privateData.options.encoding) {
      privateData.options.encoding = "UTF-8";
    }
    if (!privateData.options.contentType) {
      privateData.options.contentType = privateData.options.parsingMode === "xml" ? "application/xml" : "text/html";
    }

    this._parsingMode = privateData.options.parsingMode;

    this._implementation = DOMImplementation.createImpl([], {
      ownerDocument: this
    });

    this._defaultView = privateData.options.defaultView || null;
    this._global = privateData.options.global;
    this._documentElement = null;
    this._ids = Object.create(null);
    this._attached = true;
    this._currentScript = null;
    this._pageShowingFlag = false;
    this._cookieJar = privateData.options.cookieJar;
    this._parseOptions = privateData.options.parseOptions;
    this._scriptingDisabled = privateData.options.scriptingDisabled;
    if (this._cookieJar === undefined) {
      this._cookieJar = new CookieJar(null, { looseMode: true });
    }

    this.contentType = privateData.options.contentType;
    this._encoding = privateData.options.encoding;

    const urlOption = privateData.options.url === undefined ? "about:blank" : privateData.options.url;
    const parsed = whatwgURL.parseURL(urlOption);
    if (parsed === null) {
      throw new TypeError(`Could not parse "${urlOption}" as a URL`);
    }

    this._URL = parsed;
    this.origin = whatwgURL.serializeURLOrigin(parsed);

    this._location = Location.createImpl([], { relevantDocument: this });
    this._history = History.createImpl([], {
      window: this._defaultView,
      document: this,
      actAsIfLocationReloadCalled: () => this._location.reload()
    });

    this._workingNodeIterators = [];
    this._workingNodeIteratorsMax = privateData.options.concurrentNodeIterators === undefined ?
                                    10 :
                                    Number(privateData.options.concurrentNodeIterators);

    if (isNaN(this._workingNodeIteratorsMax)) {
      throw new TypeError("The 'concurrentNodeIterators' option must be a Number");
    }

    if (this._workingNodeIteratorsMax < 0) {
      throw new RangeError("The 'concurrentNodeIterators' option must be a non negative Number");
    }

    this._referrer = privateData.options.referrer || "";
    this._lastModified = toLastModifiedString(privateData.options.lastModified || new Date());
    this._asyncQueue = new AsyncResourceQueue();
    this._queue = new ResourceQueue({ asyncQueue: this._asyncQueue, paused: false });
    this._deferQueue = new ResourceQueue({ paused: true });
    this._requestManager = new RequestManager();
    this._currentDocumentReadiness = privateData.options.readyState || "loading";

    this._lastFocusedElement = null;

    this._resourceLoader = new PerDocumentResourceLoader(this);

    // Each Document in a browsing context can also have a latest entry. This is the entry for that Document
    // to which the browsing context's session history was most recently traversed. When a Document is created,
    // it initially has no latest entry.
    this._latestEntry = null;
  }

  _getTheParent(event) {
    if (event.type === "load" || !this._defaultView) {
      return null;
    }

    return idlUtils.implForWrapper(this._defaultView);
  }

  get compatMode() {
    return this._parsingMode === "xml" || this.doctype ? "CSS1Compat" : "BackCompat";
  }
  get charset() {
    return this._encoding;
  }
  get characterSet() {
    return this._encoding;
  }
  get inputEncoding() {
    return this._encoding;
  }
  get doctype() {
    for (const childNode of domSymbolTree.childrenIterator(this)) {
      if (childNode.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE) {
        return childNode;
      }
    }
    return null;
  }
  get URL() {
    return whatwgURL.serializeURL(this._URL);
  }
  get documentURI() {
    return whatwgURL.serializeURL(this._URL);
  }
  get location() {
    return this._defaultView ? this._location : null;
  }
  get documentElement() {
    if (this._documentElement) {
      return this._documentElement;
    }

    for (const childNode of domSymbolTree.childrenIterator(this)) {
      if (childNode.nodeType === NODE_TYPE.ELEMENT_NODE) {
        this._documentElement = childNode;
        return childNode;
      }
    }

    return null;
  }

  get implementation() {
    return this._implementation;
  }
  set implementation(implementation) {
    this._implementation = implementation;
  }

  get defaultView() {
    return this._defaultView;
  }

  get currentScript() {
    return this._currentScript;
  }

  get readyState() {
    return this._currentDocumentReadiness;
  }

  set readyState(state) {
    this._currentDocumentReadiness = state;
    fireAnEvent("readystatechange", this);
  }

  hasFocus() {
    return Boolean(this._lastFocusedElement);
  }

  _createElementWithCorrectElementInterface(localName, namespace) {
    // https://dom.spec.whatwg.org/#concept-element-interface

    if (this._elementBuilders[namespace] && this._elementBuilders[namespace][localName]) {
      return this._elementBuilders[namespace][localName](this, localName, namespace);
    } else if (namespace === HTML_NS) {
      return HTMLUnknownElement.createImpl([], {
        ownerDocument: this,
        localName,
        namespace
      });
    } else if (namespace === SVG_NS) {
      return SVGElement.createImpl([], {
        ownerDocument: this,
        localName,
        namespace
      });
    }

    return Element.createImpl([], {
      ownerDocument: this,
      localName,
      namespace
    });
  }

  appendChild(/* Node */ arg) {
    if (this.documentElement && arg.nodeType === NODE_TYPE.ELEMENT_NODE) {
      throw new DOMException("The operation would yield an incorrect node tree.", "HierarchyRequestError");
    }
    return super.appendChild(arg);
  }

  removeChild(/* Node */ arg) {
    const ret = super.removeChild(arg);
    if (arg === this._documentElement) {
      this._documentElement = null;// force a recalculation
    }
    return ret;
  }

  _descendantRemoved(parent, child) {
    if (child.tagName === "STYLE") {
      const index = this.styleSheets.indexOf(child.sheet);
      if (index > -1) {
        this.styleSheets.splice(index, 1);
      }
    }

    super._descendantRemoved.apply(this, arguments);
  }

  write() {
    let text = "";
    for (let i = 0; i < arguments.length; ++i) {
      text += String(arguments[i]);
    }

    if (this._parsingMode === "xml") {
      throw new DOMException("Cannot use document.write on XML documents", "InvalidStateError");
    }

    if (this._writeAfterElement) {
      // If called from an script element directly (during the first tick),
      // the new elements are inserted right after that element.
      const tempDiv = this.createElement("div");
      tempDiv.innerHTML = text;

      let child = tempDiv.firstChild;
      let previous = this._writeAfterElement;
      const parent = this._writeAfterElement.parentNode;

      while (child) {
        const node = child;
        child = child.nextSibling;

        node._isMovingDueToDocumentWrite = true; // hack for script execution
        parent.insertBefore(node, previous.nextSibling);
        node._isMovingDueToDocumentWrite = false;

        previous = node;
      }
    } else if (this.readyState === "loading") {
      // During page loading, document.write appends to the current element
      // Find the last child that has been added to the document.
      if (this.lastChild) {
        let node = this;
        while (node.lastChild && node.lastChild.nodeType === NODE_TYPE.ELEMENT_NODE) {
          node = node.lastChild;
        }
        node.innerHTML = text;
      } else {
        clearChildNodes(this);
        parseIntoDocument(text, this);
      }
    } else if (text) {
      clearChildNodes(this);
      parseIntoDocument(text, this);
    }
  }

  writeln() {
    this.write(...arguments, "\n");
  }

  // This is implemented separately for Document (which has a _ids cache) and DocumentFragment (which does not).
  getElementById(id) {
    if (!this._ids[id]) {
      return null;
    }

    // Let's find the first element with where it's root is the document.
    const matchElement = this._ids[id].find(candidate => {
      let root = candidate;
      while (domSymbolTree.parent(root)) {
        root = domSymbolTree.parent(root);
      }

      return root === this;
    });

    return matchElement || null;
  }

  get referrer() {
    return this._referrer || "";
  }
  get lastModified() {
    return this._lastModified;
  }
  get images() {
    return this.getElementsByTagName("IMG");
  }
  get embeds() {
    return this.getElementsByTagName("EMBED");
  }
  get plugins() {
    return this.embeds;
  }
  get links() {
    return HTMLCollection.createImpl([], {
      element: this,
      query: () => domSymbolTree.treeToArray(this, {
        filter: node => (node._localName === "a" || node._localName === "area") &&
                        node.hasAttributeNS(null, "href") &&
                        node._namespaceURI === HTML_NS
      })
    });
  }
  get forms() {
    return this.getElementsByTagName("FORM");
  }
  get scripts() {
    return this.getElementsByTagName("SCRIPT");
  }
  get anchors() {
    return HTMLCollection.createImpl([], {
      element: this,
      query: () => domSymbolTree.treeToArray(this, {
        filter: node => node._localName === "a" &&
                        node.hasAttributeNS(null, "name") &&
                        node._namespaceURI === HTML_NS
      })
    });
  }

  // The applets attribute must return an
  // HTMLCollection rooted at the Document node,
  // whose filter matches nothing.
  // (It exists for historical reasons.)
  get applets() {
    return HTMLCollection.createImpl([], {
      element: this,
      query: () => []
    });
  }

  open() {
    let child = domSymbolTree.firstChild(this);
    while (child) {
      this.removeChild(child);
      child = domSymbolTree.firstChild(this);
    }
    this._documentElement = null;
    this._modified();
    return this;
  }
  close(noQueue) {
    // In some cases like when creating an empty iframe, I want to emit the
    // events right away to avoid problems if later I asign the property src.
    if (noQueue) {
      this.readyState = "complete";

      fireAnEvent("DOMContentLoaded", this, undefined, { bubbles: true });
      fireAnEvent("load", this);

      return;
    }
    this._queue.resume();

    const dummyPromise = Promise.resolve();

    const onDOMContentLoad = () => {
      const doc = this;
      function dispatchEvent() {
        // https://html.spec.whatwg.org/#the-end
        doc.readyState = "interactive";
        fireAnEvent("DOMContentLoaded", doc, undefined, { bubbles: true });
      }

      return new Promise(resolve => {
        if (!this._deferQueue.tail) {
          dispatchEvent();
          return resolve();
        }

        this._deferQueue.setListener(() => {
          dispatchEvent();
          resolve();
        });

        return this._deferQueue.resume();
      });
    };

    const onLoad = () => {
      const doc = this;
      function dispatchEvent() {
        doc.readyState = "complete";
        fireAnEvent("load", doc);
      }

      return new Promise(resolve => {
        if (this._asyncQueue.count() === 0) {
          dispatchEvent();
          return resolve();
        }

        return this._asyncQueue.setListener(() => {
          dispatchEvent();
          resolve();
        });
      });
    };

    this._queue.push(dummyPromise, onDOMContentLoad, null);
    // Set the readyState to 'complete' once all resources are loaded.
    // As a side-effect the document's load-event will be dispatched.
    this._queue.push(dummyPromise, onLoad, null, true);
  }

  getElementsByName(elementName) {
    return NodeList.createImpl([], {
      element: this,
      query: () => domSymbolTree.treeToArray(this, {
        filter: node => node.getAttributeNS && node.getAttributeNS(null, "name") === elementName
      })
    });
  }

  get title() {
    const { documentElement } = this;
    let value = "";

    if (documentElement && documentElement._localName === "svg") {
      const svgTitleElement = firstChildWithLocalName(documentElement, "title", SVG_NS);

      if (svgTitleElement) {
        value = childTextContent(svgTitleElement);
      }
    } else {
      const titleElement = firstDescendantWithLocalName(this, "title");

      if (titleElement) {
        value = childTextContent(titleElement);
      }
    }

    value = stripAndCollapseASCIIWhitespace(value);

    return value;
  }

  set title(value) {
    const { documentElement } = this;
    let element;

    if (documentElement && documentElement._localName === "svg") {
      element = firstChildWithLocalName(documentElement, "title", SVG_NS);

      if (!element) {
        element = this.createElementNS(SVG_NS, "title");

        this._insert(element, documentElement.firstChild);
      }

      element.textContent = value;
    } else if (documentElement && documentElement._namespaceURI === HTML_NS) {
      const titleElement = firstDescendantWithLocalName(this, "title");
      const headElement = this.head;

      if (titleElement === null && headElement === null) {
        return;
      }

      if (titleElement !== null) {
        element = titleElement;
      } else {
        element = this.createElement("title");
        headElement._append(element);
      }

      element.textContent = value;
    }
  }

  get dir() {
    return this.documentElement ? this.documentElement.dir : "";
  }
  set dir(value) {
    if (this.documentElement) {
      this.documentElement.dir = value;
    }
  }

  get head() {
    return this.documentElement ? firstChildWithLocalName(this.documentElement, "head") : null;
  }

  get body() {
    const { documentElement } = this;
    if (!documentElement || documentElement._localName !== "html" ||
        documentElement._namespaceURI !== HTML_NS) {
      return null;
    }

    return firstChildWithLocalNames(this.documentElement, new Set(["body", "frameset"]));
  }

  set body(value) {
    if (value === null ||
        value._namespaceURI !== HTML_NS ||
        (value._localName !== "body" && value._localName !== "frameset")) {
      throw new DOMException("Cannot set the body to null or a non-body/frameset element", "HierarchyRequestError");
    }

    const bodyElement = this.body;
    if (value === bodyElement) {
      return;
    }

    if (bodyElement !== null) {
      bodyElement.parentNode._replace(value, bodyElement);
      return;
    }

    const { documentElement } = this;
    if (documentElement === null) {
      throw new DOMException("Cannot set the body when there is no document element", "HierarchyRequestError");
    }

    documentElement._append(value);
  }

  _runPreRemovingSteps(oldNode) {
    for (const activeNodeIterator of this._workingNodeIterators) {
      activeNodeIterator._preRemovingSteps(oldNode);
    }
  }

  createEvent(type) {
    const typeLower = type.toLowerCase();
    const eventWrapper = eventInterfaceTable[typeLower] || null;

    if (!eventWrapper) {
      throw new DOMException("The provided event type (\"" + type + "\") is invalid", "NotSupportedError");
    }

    const impl = eventWrapper.createImpl([""]);
    impl._initializedFlag = false;
    return impl;
  }

  createProcessingInstruction(target, data) {
    validateName(target);

    if (data.includes("?>")) {
      throw new DOMException("Processing instruction data cannot contain the string \"?>\"", "InvalidCharacterError");
    }

    return ProcessingInstruction.createImpl([], {
      ownerDocument: this,
      target,
      data
    });
  }

  // https://dom.spec.whatwg.org/#dom-document-createcdatasection
  createCDATASection(data) {
    if (this._parsingMode === "html") {
      throw new DOMException("Cannot create CDATA sections in HTML documents", "NotSupportedError");
    }

    if (data.includes("]]>")) {
      throw new DOMException("CDATA section data cannot contain the string \"]]>\"", "InvalidCharacterError");
    }

    return CDATASection.createImpl([], {
      ownerDocument: this,
      data
    });
  }

  createTextNode(data) {
    return Text.createImpl([], {
      ownerDocument: this,
      data
    });
  }

  createComment(data) {
    return Comment.createImpl([], {
      ownerDocument: this,
      data
    });
  }

  createElement(localName) {
    validateName(localName);
    if (this._parsingMode === "html") {
      localName = asciiLowercase(localName);
    }

    const namespace = this._parsingMode === "html" || this.contentType === "application/xhtml+xml" ? HTML_NS : null;

    return this._createElementWithCorrectElementInterface(localName, namespace);
  }

  createElementNS(namespace, qualifiedName) {
    namespace = namespace !== null ? String(namespace) : namespace;

    const extracted = validateAndExtract(namespace, qualifiedName);

    const element = this._createElementWithCorrectElementInterface(extracted.localName, extracted.namespace);
    element._prefix = extracted.prefix;

    return element;
  }

  createDocumentFragment() {
    return DocumentFragment.createImpl([], { ownerDocument: this });
  }

  createAttribute(localName) {
    validateName(localName);

    if (this._parsingMode === "html") {
      localName = asciiLowercase(localName);
    }

    return generatedAttr.createImpl([], { localName });
  }

  createAttributeNS(namespace, name) {
    if (namespace === undefined) {
      namespace = null;
    }
    namespace = namespace !== null ? String(namespace) : namespace;

    const extracted = validateAndExtract(namespace, name);
    return generatedAttr.createImpl([], {
      namespace: extracted.namespace,
      namespacePrefix: extracted.prefix,
      localName: extracted.localName
    });
  }

  // TODO: Add callback interface support to `webidl2js`
  createTreeWalker(root, whatToShow, filter) {
    return TreeWalker.createImpl([], { root, whatToShow, filter });
  }

  createNodeIterator(root, whatToShow, filter) {
    const nodeIterator = NodeIterator.createImpl([], { root, whatToShow, filter });

    this._workingNodeIterators.push(nodeIterator);
    while (this._workingNodeIterators.length > this._workingNodeIteratorsMax) {
      const toInactivate = this._workingNodeIterators.shift();
      toInactivate._working = false;
    }

    return nodeIterator;
  }

  importNode(node, deep) {
    if (node.nodeType === NODE_TYPE.DOCUMENT_NODE) {
      throw new DOMException("Cannot import a document node", "NotSupportedError");
    } else if (ShadowRoot.isImpl(node)) {
      throw new DOMException("Cannot adopt a shadow root", "NotSupportedError");
    }

    return clone(node, this, deep);
  }

  // https://dom.spec.whatwg.org/#dom-document-adoptnode
  adoptNode(node) {
    if (node.nodeType === NODE_TYPE.DOCUMENT_NODE) {
      throw new DOMException("Cannot adopt a document node", "NotSupportedError");
    } else if (ShadowRoot.isImpl(node)) {
      throw new DOMException("Cannot adopt a shadow root", "HierarchyRequestError");
    }

    this._adoptNode(node);

    return node;
  }

  // https://dom.spec.whatwg.org/#concept-node-adopt
  _adoptNode(node) {
    const newDocument = this;
    const oldDocument = node._ownerDocument;

    const parent = domSymbolTree.parent(node);
    if (parent) {
      parent._remove(node);
    }

    if (oldDocument !== newDocument) {
      for (const inclusiveDescendant of shadowIncludingInclusiveDescendantsIterator(node)) {
        inclusiveDescendant._ownerDocument = newDocument;
      }

      for (const inclusiveDescendant of shadowIncludingInclusiveDescendantsIterator(node)) {
        if (inclusiveDescendant._adoptingSteps) {
          inclusiveDescendant._adoptingSteps(oldDocument);
        }
      }
    }
  }

  get cookie() {
    return this._cookieJar.getCookieStringSync(this.URL, { http: false });
  }
  set cookie(cookieStr) {
    cookieStr = String(cookieStr);
    this._cookieJar.setCookieSync(cookieStr, this.URL, {
      http: false,
      ignoreError: true
    });
  }

  // The clear(), captureEvents(), and releaseEvents() methods must do nothing
  clear() {}

  captureEvents() {}

  releaseEvents() {}

  get styleSheets() {
    if (!this._styleSheets) {
      this._styleSheets = new StyleSheetList();
    }

    // TODO: each style and link element should register its sheet on creation
    // and remove it on removal.
    return this._styleSheets;
  }

  get hidden() {
    if (this._defaultView && this._defaultView._pretendToBeVisual) {
      return false;
    }

    return true;
  }

  get visibilityState() {
    if (this._defaultView && this._defaultView._pretendToBeVisual) {
      return "visible";
    }

    return "prerender";
  }
}

eventAccessors.createEventAccessor(DocumentImpl.prototype, "readystatechange");
mixin(DocumentImpl.prototype, DocumentOrShadowRootImpl.prototype);
mixin(DocumentImpl.prototype, GlobalEventHandlersImpl.prototype);
mixin(DocumentImpl.prototype, NonElementParentNodeImpl.prototype);
mixin(DocumentImpl.prototype, ParentNodeImpl.prototype);

DocumentImpl.prototype._elementBuilders = Object.create(null);

DocumentImpl.prototype.getElementsByTagName = memoizeQuery(function (qualifiedName) {
  return listOfElementsWithQualifiedName(qualifiedName, this);
});

DocumentImpl.prototype.getElementsByTagNameNS = memoizeQuery(function (namespace, localName) {
  return listOfElementsWithNamespaceAndLocalName(namespace, localName, this);
});

DocumentImpl.prototype.getElementsByClassName = memoizeQuery(function getElementsByClassName(classNames) {
  return listOfElementsWithClassNames(classNames, this);
});

module.exports = {
  implementation: DocumentImpl
};
