"use strict";

const DOMException = require("domexception");

const EventTargetImpl = require("../events/EventTarget-impl").implementation;
const { simultaneousIterators } = require("../../utils");
const NODE_TYPE = require("../node-type");
const NODE_DOCUMENT_POSITION = require("../node-document-position");
const NodeList = require("../generated/NodeList");
const { clone, locateNamespacePrefix, locateNamespace } = require("../node");
const attributes = require("../attributes");

const { domSymbolTree } = require("../helpers/internal-constants");
const { documentBaseURLSerialized } = require("../helpers/document-base-url");
const { queueTreeMutationRecord } = require("../helpers/mutation-observers");
const {
  isShadowRoot, getRoot, shadowIncludingRoot, assignSlot, assignSlotableForTree, assignSlotable,
  signalSlotChange, isSlot
} = require("../helpers/shadow-dom");

function isObsoleteNodeType(node) {
  return node.nodeType === NODE_TYPE.ENTITY_NODE ||
    node.nodeType === NODE_TYPE.ENTITY_REFERENCE_NODE ||
    node.nodeType === NODE_TYPE.NOTATION_NODE ||
  //  node.nodeType === NODE_TYPE.ATTRIBUTE_NODE ||  // this is missing how do we handle?
    node.nodeType === NODE_TYPE.CDATA_SECTION_NODE;
}

function nodeEquals(a, b) {
  if (a.nodeType !== b.nodeType) {
    return false;
  }

  switch (a.nodeType) {
    case NODE_TYPE.DOCUMENT_TYPE_NODE:
      if (a.name !== b.name || a.publicId !== b.publicId ||
          a.systemId !== b.systemId) {
        return false;
      }
      break;
    case NODE_TYPE.ELEMENT_NODE:
      if (a._namespaceURI !== b._namespaceURI || a._prefix !== b._prefix || a._localName !== b._localName ||
          a._attributes.length !== b._attributes.length) {
        return false;
      }
      break;
    case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
      if (a._target !== b._target || a._data !== b._data) {
        return false;
      }
      break;
    case NODE_TYPE.TEXT_NODE:
    case NODE_TYPE.COMMENT_NODE:
      if (a._data !== b._data) {
        return false;
      }
      break;
  }

  if (a.nodeType === NODE_TYPE.ELEMENT_NODE && !attributes.attributeListsEqual(a, b)) {
    return false;
  }

  for (const nodes of simultaneousIterators(domSymbolTree.childrenIterator(a), domSymbolTree.childrenIterator(b))) {
    if (!nodes[0] || !nodes[1]) {
      // mismatch in the amount of childNodes
      return false;
    }

    if (!nodeEquals(nodes[0], nodes[1])) {
      return false;
    }
  }

  return true;
}

// https://dom.spec.whatwg.org/#concept-tree-host-including-inclusive-ancestor
function isHostInclusiveAncestor(nodeImplA, nodeImplB) {
  for (const ancestor of domSymbolTree.ancestorsIterator(nodeImplB)) {
    if (ancestor === nodeImplA) {
      return true;
    }
  }

  const rootImplB = getRoot(nodeImplB);
  if (rootImplB._host) {
    return isHostInclusiveAncestor(nodeImplA, rootImplB._host);
  }

  return false;
}

class NodeImpl extends EventTargetImpl {
  constructor(args, privateData) {
    super();

    domSymbolTree.initialize(this);

    this._ownerDocument = privateData.ownerDocument;

    this._childNodesList = null;
    this._childrenList = null;
    this._version = 0;
    this._memoizedQueries = {};
    this._registeredObserverList = [];
  }

  _getTheParent() {
    if (this._assignedSlot) {
      return this._assignedSlot;
    }

    return domSymbolTree.parent(this);
  }

  get parentNode() {
    return domSymbolTree.parent(this);
  }

  getRootNode(options) {
    return options.composed ? shadowIncludingRoot(this) : getRoot(this);
  }

  get nodeName() {
    switch (this.nodeType) {
      case NODE_TYPE.ELEMENT_NODE:
        return this.tagName;
      case NODE_TYPE.TEXT_NODE:
        return "#text";
      case NODE_TYPE.CDATA_SECTION_NODE:
        return "#cdata-section";
      case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
        return this.target;
      case NODE_TYPE.COMMENT_NODE:
        return "#comment";
      case NODE_TYPE.DOCUMENT_NODE:
        return "#document";
      case NODE_TYPE.DOCUMENT_TYPE_NODE:
        return this.name;
      case NODE_TYPE.DOCUMENT_FRAGMENT_NODE:
        return "#document-fragment";
    }

    // should never happen
    return null;
  }

  get firstChild() {
    return domSymbolTree.firstChild(this);
  }

  // https://dom.spec.whatwg.org/#connected
  // https://dom.spec.whatwg.org/#dom-node-isconnected
  get isConnected() {
    const root = shadowIncludingRoot(this);
    return root && root.nodeType === NODE_TYPE.DOCUMENT_NODE;
  }

  get ownerDocument() {
    return this.nodeType === NODE_TYPE.DOCUMENT_NODE ? null : this._ownerDocument;
  }

  get lastChild() {
    return domSymbolTree.lastChild(this);
  }

  get childNodes() {
    if (!this._childNodesList) {
      this._childNodesList = NodeList.createImpl([], {
        element: this,
        query: () => domSymbolTree.childrenToArray(this)
      });
    } else {
      this._childNodesList._update();
    }

    return this._childNodesList;
  }

  get nextSibling() {
    return domSymbolTree.nextSibling(this);
  }

  get previousSibling() {
    return domSymbolTree.previousSibling(this);
  }

  _modified() {
    this._version++;
    for (const ancestor of domSymbolTree.ancestorsIterator(this)) {
      ancestor._version++;
    }

    if (this._childrenList) {
      this._childrenList._update();
    }
    if (this._childNodesList) {
      this._childNodesList._update();
    }
    this._clearMemoizedQueries();
  }

  _childTextContentChangeSteps() {
    // Default: do nothing
  }

  _clearMemoizedQueries() {
    this._memoizedQueries = {};
    const myParent = domSymbolTree.parent(this);
    if (myParent) {
      myParent._clearMemoizedQueries();
    }
  }

  _descendantRemoved(parent, child) {
    const myParent = domSymbolTree.parent(this);
    if (myParent) {
      myParent._descendantRemoved(parent, child);
    }
  }

  _descendantAdded(parent, child) {
    const myParent = domSymbolTree.parent(this);
    if (myParent) {
      myParent._descendantAdded(parent, child);
    }
  }

  _attach() {
    this._attached = true;

    for (const child of domSymbolTree.childrenIterator(this)) {
      if (child._attach) {
        child._attach();
      }
    }
  }

  _detach() {
    this._attached = false;

    if (this._ownerDocument && this._ownerDocument._lastFocusedElement === this) {
      this._ownerDocument._lastFocusedElement = null;
    }

    for (const child of domSymbolTree.childrenIterator(this)) {
      if (child._detach) {
        child._detach();
      }
    }
  }

  hasChildNodes() {
    return domSymbolTree.hasChildren(this);
  }

  normalize() {
    for (const child of domSymbolTree.childrenIterator(this)) {
      if (child.normalize) {
        child.normalize();
      }

      // Normalize should only transform Text nodes, and nothing else.
      if (child.nodeType !== NODE_TYPE.TEXT_NODE) {
        continue;
      }

      if (child.nodeValue === "") {
        this._remove(child);
        continue;
      }

      const prevChild = domSymbolTree.previousSibling(child);

      if (prevChild && prevChild.nodeType === NODE_TYPE.TEXT_NODE) {
        // merge text nodes
        prevChild.appendData(child.nodeValue);
        this._remove(child);
      }
    }
  }

  get parentElement() {
    const parentNode = domSymbolTree.parent(this);
    return parentNode !== null && parentNode.nodeType === NODE_TYPE.ELEMENT_NODE ? parentNode : null;
  }

  get baseURI() {
    return documentBaseURLSerialized(this._ownerDocument);
  }

  compareDocumentPosition(otherImpl) {
    // Let reference be the context object.
    const reference = this;

    if (isObsoleteNodeType(reference) || isObsoleteNodeType(otherImpl)) {
      throw new Error("Obsolete node type");
    }

    const result = domSymbolTree.compareTreePosition(reference, otherImpl);

    // “If other and reference are not in the same tree, return the result of adding DOCUMENT_POSITION_DISCONNECTED,
    //  DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC, and either DOCUMENT_POSITION_PRECEDING or
    // DOCUMENT_POSITION_FOLLOWING, with the constraint that this is to be consistent, together.”
    if (result === NODE_DOCUMENT_POSITION.DOCUMENT_POSITION_DISCONNECTED) {
      // symbol-tree does not add these bits required by the spec:
      return NODE_DOCUMENT_POSITION.DOCUMENT_POSITION_DISCONNECTED |
        NODE_DOCUMENT_POSITION.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC |
        NODE_DOCUMENT_POSITION.DOCUMENT_POSITION_FOLLOWING;
    }

    return result;
  }

  lookupPrefix(namespace) {
    if (namespace === null || namespace === "") {
      return null;
    }

    switch (this.nodeType) {
      case NODE_TYPE.ELEMENT_NODE: {
        return locateNamespacePrefix(this, namespace);
      }
      case NODE_TYPE.DOCUMENT_NODE: {
        return this.documentElement !== null ? locateNamespacePrefix(this.documentElement, namespace) : null;
      }
      case NODE_TYPE.DOCUMENT_TYPE_NODE:
      case NODE_TYPE.DOCUMENT_FRAGMENT_NODE: {
        return null;
      }
      case NODE_TYPE.ATTRIBUTE_NODE: {
        return this._element !== null ? locateNamespacePrefix(this._element, namespace) : null;
      }
      default: {
        return this.parentElement !== null ? locateNamespacePrefix(this.parentElement, namespace) : null;
      }
    }
  }

  lookupNamespaceURI(prefix) {
    if (prefix === "") {
      prefix = null;
    }

    return locateNamespace(this, prefix);
  }

  isDefaultNamespace(namespace) {
    if (namespace === "") {
      namespace = null;
    }

    const defaultNamespace = locateNamespace(this, null);
    return defaultNamespace === namespace;
  }

  contains(other) {
    if (other === null) {
      return false;
    } else if (this === other) {
      return true;
    }
    return Boolean(this.compareDocumentPosition(other) & NODE_DOCUMENT_POSITION.DOCUMENT_POSITION_CONTAINED_BY);
  }

  isEqualNode(node) {
    if (node === null) {
      return false;
    }

    // Fast-path, not in the spec
    if (this === node) {
      return true;
    }

    return nodeEquals(this, node);
  }

  isSameNode(node) {
    if (this === node) {
      return true;
    }

    return false;
  }

  cloneNode(deep) {
    if (isShadowRoot(this)) {
      throw new DOMException("ShadowRoot nodes are not clonable.", "NotSupportedError");
    }

    deep = Boolean(deep);

    return clone(this, undefined, deep);
  }

  get nodeValue() {
    switch (this.nodeType) {
      case NODE_TYPE.ATTRIBUTE_NODE: {
        return this._value;
      }
      case NODE_TYPE.TEXT_NODE:
      case NODE_TYPE.CDATA_SECTION_NODE: // CDATASection is a subclass of Text
      case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
      case NODE_TYPE.COMMENT_NODE: {
        return this._data;
      }
      default: {
        return null;
      }
    }
  }

  set nodeValue(value) {
    if (value === null) {
      value = "";
    }

    switch (this.nodeType) {
      case NODE_TYPE.ATTRIBUTE_NODE: {
        attributes.setAnExistingAttributeValue(this, value);
        break;
      }
      case NODE_TYPE.TEXT_NODE:
      case NODE_TYPE.CDATA_SECTION_NODE: // CDATASection is a subclass of Text
      case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
      case NODE_TYPE.COMMENT_NODE: {
        this.replaceData(0, this.length, value);
        break;
      }
    }
  }

  get textContent() {
    switch (this.nodeType) {
      case NODE_TYPE.DOCUMENT_FRAGMENT_NODE:
      case NODE_TYPE.ELEMENT_NODE: {
        let text = "";
        for (const child of domSymbolTree.treeIterator(this)) {
          if (child.nodeType === NODE_TYPE.TEXT_NODE || child.nodeType === NODE_TYPE.CDATA_SECTION_NODE) {
            text += child.nodeValue;
          }
        }
        return text;
      }

      case NODE_TYPE.ATTRIBUTE_NODE: {
        return this._value;
      }

      case NODE_TYPE.TEXT_NODE:
      case NODE_TYPE.CDATA_SECTION_NODE: // CDATASection is a subclass of Text
      case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
      case NODE_TYPE.COMMENT_NODE: {
        return this._data;
      }

      default: {
        return null;
      }
    }
  }

  set textContent(value) {
    switch (this.nodeType) {
      case NODE_TYPE.DOCUMENT_FRAGMENT_NODE:
      case NODE_TYPE.ELEMENT_NODE: {
        let nodeImpl = null;

        if (value !== null && value !== "") {
          nodeImpl = this._ownerDocument.createTextNode(value);
        }

        this._replaceAll(nodeImpl);
        break;
      }

      case NODE_TYPE.ATTRIBUTE_NODE: {
        attributes.setAnExistingAttributeValue(this, value);
        break;
      }

      case NODE_TYPE.TEXT_NODE:
      case NODE_TYPE.CDATA_SECTION_NODE: // CDATASection is a subclass of Text
      case NODE_TYPE.PROCESSING_INSTRUCTION_NODE:
      case NODE_TYPE.COMMENT_NODE: {
        this.replaceData(0, this.length, value);
        break;
      }
    }
  }

  // https://dom.spec.whatwg.org/#dom-node-insertbefore
  insertBefore(nodeImpl, childImpl) {
    return this._preInsert(nodeImpl, childImpl);
  }

  // https://dom.spec.whatwg.org/#dom-node-appendchild
  appendChild(nodeImpl) {
    return this._append(nodeImpl);
  }

  // https://dom.spec.whatwg.org/#dom-node-replacechild
  replaceChild(nodeImpl, childImpl) {
    return this._replace(nodeImpl, childImpl);
  }

  // https://dom.spec.whatwg.org/#dom-node-removechild
  removeChild(oldChildImpl) {
    return this._preRemove(oldChildImpl);
  }

  // https://dom.spec.whatwg.org/#concept-node-ensure-pre-insertion-validity
  _preInsertValidity(nodeImpl, childImpl) {
    const { nodeType, nodeName } = nodeImpl;
    const { nodeType: parentType, nodeName: parentName } = this;

    if (
      parentType !== NODE_TYPE.DOCUMENT_NODE &&
      parentType !== NODE_TYPE.DOCUMENT_FRAGMENT_NODE &&
      parentType !== NODE_TYPE.ELEMENT_NODE
    ) {
      throw new DOMException(`Node can't be inserted in a ${parentName} parent.`, "HierarchyRequestError");
    }

    if (isHostInclusiveAncestor(nodeImpl, this)) {
      throw new DOMException("The operation would yield an incorrect node tree.", "HierarchyRequestError");
    }

    if (childImpl && domSymbolTree.parent(childImpl) !== this) {
      throw new DOMException("The child can not be found in the parent.", "NotFoundError");
    }

    if (
      nodeType !== NODE_TYPE.DOCUMENT_FRAGMENT_NODE &&
      nodeType !== NODE_TYPE.DOCUMENT_TYPE_NODE &&
      nodeType !== NODE_TYPE.ELEMENT_NODE &&
      nodeType !== NODE_TYPE.TEXT_NODE &&
      nodeType !== NODE_TYPE.CDATA_SECTION_NODE && // CData section extends from Text
      nodeType !== NODE_TYPE.PROCESSING_INSTRUCTION_NODE &&
      nodeType !== NODE_TYPE.COMMENT_NODE
    ) {
      throw new DOMException(`${nodeName} node can't be inserted in parent node.`, "HierarchyRequestError");
    }

    if (
      (nodeType === NODE_TYPE.TEXT_NODE && parentType === NODE_TYPE.DOCUMENT_NODE) ||
      (nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE && parentType !== NODE_TYPE.DOCUMENT_NODE)
    ) {
      throw new DOMException(`${nodeName} node can't be inserted in ${parentName} parent.`, "HierarchyRequestError");
    }

    if (parentType === NODE_TYPE.DOCUMENT_NODE) {
      const nodeChildren = domSymbolTree.childrenToArray(nodeImpl);
      const parentChildren = domSymbolTree.childrenToArray(this);

      switch (nodeType) {
        case NODE_TYPE.DOCUMENT_FRAGMENT_NODE: {
          const nodeChildrenElements = nodeChildren.filter(child => child.nodeType === NODE_TYPE.ELEMENT_NODE);
          if (nodeChildrenElements.length > 1) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }

          const hasNodeTextChildren = nodeChildren.some(child => child.nodeType === NODE_TYPE.TEXT_NODE);
          if (hasNodeTextChildren) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }

          if (
            nodeChildrenElements.length === 1 &&
            (
              parentChildren.some(child => child.nodeType === NODE_TYPE.ELEMENT_NODE) ||
              (childImpl && childImpl.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE) ||
              (
                childImpl &&
                domSymbolTree.nextSibling(childImpl) &&
                domSymbolTree.nextSibling(childImpl).nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE
              )
            )
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;
        }

        case NODE_TYPE.ELEMENT_NODE:
          if (
            parentChildren.some(child => child.nodeType === NODE_TYPE.ELEMENT_NODE) ||
            (childImpl && childImpl.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE) ||
            (
              childImpl &&
              domSymbolTree.nextSibling(childImpl) &&
              domSymbolTree.nextSibling(childImpl).nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE
            )
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;

        case NODE_TYPE.DOCUMENT_TYPE_NODE:
          if (
            parentChildren.some(child => child.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE) ||
            (
              childImpl &&
              domSymbolTree.previousSibling(childImpl) &&
              domSymbolTree.previousSibling(childImpl).nodeType === NODE_TYPE.ELEMENT_NODE
            ) ||
            (!childImpl && parentChildren.some(child => child.nodeType === NODE_TYPE.ELEMENT_NODE))
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;
      }
    }
  }

  // https://dom.spec.whatwg.org/#concept-node-pre-insert
  _preInsert(nodeImpl, childImpl) {
    this._preInsertValidity(nodeImpl, childImpl);

    let referenceChildImpl = childImpl;
    if (referenceChildImpl === nodeImpl) {
      referenceChildImpl = domSymbolTree.nextSibling(nodeImpl);
    }

    this._ownerDocument._adoptNode(nodeImpl);

    this._insert(nodeImpl, referenceChildImpl);

    return nodeImpl;
  }

  // https://dom.spec.whatwg.org/#concept-node-insert
  _insert(nodeImpl, childImpl, suppressObservers) {
    const nodesImpl = nodeImpl.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE ?
      domSymbolTree.childrenToArray(nodeImpl) :
      [nodeImpl];

    if (nodeImpl.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE) {
      let grandChildImpl;
      while ((grandChildImpl = domSymbolTree.firstChild(nodeImpl))) {
        nodeImpl._remove(grandChildImpl, true);
      }
    }

    if (nodeImpl.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE) {
      queueTreeMutationRecord(nodeImpl, [], nodesImpl, null, null);
    }

    const previousChildImpl = childImpl ?
      domSymbolTree.previousSibling(childImpl) :
      domSymbolTree.lastChild(this);

    for (const node of nodesImpl) {
      if (!childImpl) {
        domSymbolTree.appendChild(this, node);
      } else {
        domSymbolTree.insertBefore(childImpl, node);
      }

      if (
        (this.nodeType === NODE_TYPE.ELEMENT_NODE && this._shadowRoot !== null) &&
        (node.nodeType === NODE_TYPE.ELEMENT_NODE || node.nodeType === NODE_TYPE.TEXT_NODE)
      ) {
        assignSlot(node);
      }

      this._modified();

      if (node.nodeType === NODE_TYPE.TEXT_NODE ||
          node.nodeType === NODE_TYPE.CDATA_SECTION_NODE) {
        this._childTextContentChangeSteps();
      }

      if (isSlot(this) && this._assignedNodes.length === 0 && isShadowRoot(getRoot(this))) {
        signalSlotChange(this);
      }

      const root = getRoot(node);
      if (isShadowRoot(root)) {
        assignSlotableForTree(root);
      }

      if (this._attached && nodeImpl._attach) {
        node._attach();
      }

      this._descendantAdded(this, node);
    }

    if (!suppressObservers) {
      queueTreeMutationRecord(this, nodesImpl, [], previousChildImpl, childImpl);
    }
  }

  // https://dom.spec.whatwg.org/#concept-node-append
  _append(nodeImpl) {
    return this._preInsert(nodeImpl, null);
  }

  // https://dom.spec.whatwg.org/#concept-node-replace
  _replace(nodeImpl, childImpl) {
    const { nodeType, nodeName } = nodeImpl;
    const { nodeType: parentType, nodeName: parentName } = this;

    // Note: This section differs from the pre-insert validation algorithm.
    if (
      parentType !== NODE_TYPE.DOCUMENT_NODE &&
      parentType !== NODE_TYPE.DOCUMENT_FRAGMENT_NODE &&
      parentType !== NODE_TYPE.ELEMENT_NODE
    ) {
      throw new DOMException(`Node can't be inserted in a ${parentName} parent.`, "HierarchyRequestError");
    }

    if (isHostInclusiveAncestor(nodeImpl, this)) {
      throw new DOMException("The operation would yield an incorrect node tree.", "HierarchyRequestError");
    }

    if (childImpl && domSymbolTree.parent(childImpl) !== this) {
      throw new DOMException("The child can not be found in the parent.", "NotFoundError");
    }

    if (
      nodeType !== NODE_TYPE.DOCUMENT_FRAGMENT_NODE &&
      nodeType !== NODE_TYPE.DOCUMENT_TYPE_NODE &&
      nodeType !== NODE_TYPE.ELEMENT_NODE &&
      nodeType !== NODE_TYPE.TEXT_NODE &&
      nodeType !== NODE_TYPE.CDATA_SECTION_NODE && // CData section extends from Text
      nodeType !== NODE_TYPE.PROCESSING_INSTRUCTION_NODE &&
      nodeType !== NODE_TYPE.COMMENT_NODE
    ) {
      throw new DOMException(`${nodeName} node can't be inserted in parent node.`, "HierarchyRequestError");
    }

    if (
      (nodeType === NODE_TYPE.TEXT_NODE && parentType === NODE_TYPE.DOCUMENT_NODE) ||
      (nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE && parentType !== NODE_TYPE.DOCUMENT_NODE)
    ) {
      throw new DOMException(`${nodeName} node can't be inserted in ${parentName} parent.`, "HierarchyRequestError");
    }

    if (parentType === NODE_TYPE.DOCUMENT_NODE) {
      const nodeChildren = domSymbolTree.childrenToArray(nodeImpl);
      const parentChildren = domSymbolTree.childrenToArray(this);

      switch (nodeType) {
        case NODE_TYPE.DOCUMENT_FRAGMENT_NODE: {
          const nodeChildrenElements = nodeChildren.filter(child => child.nodeType === NODE_TYPE.ELEMENT_NODE);
          if (nodeChildrenElements.length > 1) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }

          const hasNodeTextChildren = nodeChildren.some(child => child.nodeType === NODE_TYPE.TEXT_NODE);
          if (hasNodeTextChildren) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }


          const parentChildElements = parentChildren.filter(child => child.nodeType === NODE_TYPE.ELEMENT_NODE);
          if (
            nodeChildrenElements.length === 1 &&
            (
              (parentChildElements.length === 1 && parentChildElements[0] !== childImpl) ||
              (
                childImpl &&
                domSymbolTree.nextSibling(childImpl) &&
                domSymbolTree.nextSibling(childImpl).nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE
              )
            )
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;
        }

        case NODE_TYPE.ELEMENT_NODE:
          if (
            parentChildren.some(child => child.nodeType === NODE_TYPE.ELEMENT_NODE && child !== childImpl) ||
            (
              childImpl &&
              domSymbolTree.nextSibling(childImpl) &&
              domSymbolTree.nextSibling(childImpl).nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE
            )
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;

        case NODE_TYPE.DOCUMENT_TYPE_NODE:
          if (
            parentChildren.some(child => child.nodeType === NODE_TYPE.DOCUMENT_TYPE_NODE && child !== childImpl) ||
            (
              childImpl &&
              domSymbolTree.previousSibling(childImpl) &&
              domSymbolTree.previousSibling(childImpl).nodeType === NODE_TYPE.ELEMENT_NODE
            )
          ) {
            throw new DOMException(
              `Invalid insertion of ${nodeName} node in ${parentName} node.`,
              "HierarchyRequestError"
            );
          }
          break;
      }
    }

    let referenceChildImpl = domSymbolTree.nextSibling(childImpl);
    if (referenceChildImpl === nodeImpl) {
      referenceChildImpl = domSymbolTree.nextSibling(nodeImpl);
    }

    const previousSiblingImpl = domSymbolTree.previousSibling(childImpl);

    this._ownerDocument._adoptNode(nodeImpl);

    let removedNodesImpl = [];

    if (domSymbolTree.parent(childImpl)) {
      removedNodesImpl = [childImpl];
      this._remove(childImpl, true);
    }

    const nodesImpl = nodeImpl.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE ?
      domSymbolTree.childrenToArray(nodeImpl) :
      [nodeImpl];

    this._insert(nodeImpl, referenceChildImpl, true);

    queueTreeMutationRecord(this, nodesImpl, removedNodesImpl, previousSiblingImpl, referenceChildImpl);

    return childImpl;
  }

  // https://dom.spec.whatwg.org/#concept-node-replace-all
  _replaceAll(nodeImpl) {
    if (nodeImpl !== null) {
      this._ownerDocument._adoptNode(nodeImpl);
    }

    const removedNodesImpl = domSymbolTree.childrenToArray(this);

    let addedNodesImpl;
    if (nodeImpl === null) {
      addedNodesImpl = [];
    } else if (nodeImpl.nodeType === NODE_TYPE.DOCUMENT_FRAGMENT_NODE) {
      addedNodesImpl = domSymbolTree.childrenToArray(nodeImpl);
    } else {
      addedNodesImpl = [nodeImpl];
    }

    for (const childImpl of domSymbolTree.childrenIterator(this)) {
      this._remove(childImpl, true);
    }

    if (nodeImpl) {
      this._insert(nodeImpl, null, true);
    }

    queueTreeMutationRecord(this, addedNodesImpl, removedNodesImpl, null, null);
  }

  // https://dom.spec.whatwg.org/#concept-node-pre-remove
  _preRemove(childImpl) {
    if (domSymbolTree.parent(childImpl) !== this) {
      throw new DOMException("The node to be removed is not a child of this node.", "NotFoundError");
    }

    this._remove(childImpl);

    return childImpl;
  }

  // https://dom.spec.whatwg.org/#concept-node-remove
  _remove(nodeImpl, suppressObservers) {
    if (this._ownerDocument) {
      this._ownerDocument._runPreRemovingSteps(nodeImpl);
    }

    const oldPreviousSiblingImpl = domSymbolTree.previousSibling(nodeImpl);
    const oldNextSiblingImpl = domSymbolTree.nextSibling(nodeImpl);

    domSymbolTree.remove(nodeImpl);

    if (nodeImpl._assignedSlot) {
      assignSlotable(nodeImpl._assignedSlot);
    }

    if (isSlot(this) && this._assignedNodes.length === 0 && isShadowRoot(getRoot(this))) {
      signalSlotChange(this);
    }

    let hasSlotDescendant = isSlot(nodeImpl);
    if (!hasSlotDescendant) {
      for (const child of domSymbolTree.treeIterator(nodeImpl)) {
        if (isSlot(child)) {
          hasSlotDescendant = true;
          break;
        }
      }
    }

    if (hasSlotDescendant) {
      assignSlotableForTree(getRoot(this));
      assignSlotableForTree(nodeImpl);
    }

    this._modified();
    nodeImpl._detach();
    this._descendantRemoved(this, nodeImpl);

    if (!suppressObservers) {
      queueTreeMutationRecord(this, [], [nodeImpl], oldPreviousSiblingImpl, oldNextSiblingImpl);
    }

    if (nodeImpl.nodeType === NODE_TYPE.TEXT_NODE) {
      this._childTextContentChangeSteps();
    }
  }
}

module.exports = {
  implementation: NodeImpl
};
