"use strict";

const DOMException = require("../../web-idl/DOMException");
const idlUtils = require("../generated/utils");
const conversions = require("webidl-conversions");

// FIXME: Once NodeFilter is ported to IDL method, uncomment these.
const FILTER_ACCEPT = 1; // NodeFilter.FILTER_ACCEPT;
const FILTER_REJECT = 2; // NodeFilter.FILTER_REJECT;
const FILTER_SKIP = 3; // NodeFilter.FILTER_SKIP;
const FIRST = false;
const LAST = true;
const NEXT = false;
const PREVIOUS = true;

function isNull(o) {
  return o === null || typeof o === "undefined";
}

class TreeWalkerImpl {
  constructor(args, privateData) {
    this.root = privateData.root;
    this.whatToShow = privateData.whatToShow;
    this.filter = privateData.filter;
    this.currentNode = this.root;
  }

  get currentNode() {
    return this._currentNode;
  }

  set currentNode(node) {
    if (isNull(node)) {
      throw new DOMException(DOMException.NOT_SUPPORTED_ERR, "Cannot set currentNode to null");
    }

    this._currentNode = node;
  }

  parentNode() {
    let node = this._currentNode;
    while (!isNull(node) && node !== this.root) {
      node = node.parentNode;

      if (!isNull(node) && this._filterNode(node) === FILTER_ACCEPT) {
        return (this._currentNode = node);
      }
    }
    return null;
  }

  firstChild() {
    return this._traverseChildren(FIRST);
  }

  lastChild() {
    return this._traverseChildren(LAST);
  }

  previousSibling() {
    return this._traverseSiblings(PREVIOUS);
  }

  nextSibling() {
    return this._traverseSiblings(NEXT);
  }

  previousNode() {
    let node = this._currentNode;

    while (node !== this.root) {
      let sibling = node.previousSibling;

      while (!isNull(sibling)) {
        node = sibling;
        let result = this._filterNode(node);

        while (result !== FILTER_REJECT && node.hasChildNodes()) {
          node = node.lastChild;
          result = this._filterNode(node);
        }

        if (result === FILTER_ACCEPT) {
          return (this._currentNode = node);
        }

        sibling = node.previousSibling;
      }

      if (node === this.root || isNull(node.parentNode)) {
        return null;
      }

      node = node.parentNode;

      if (this._filterNode(node) === FILTER_ACCEPT) {
        return (this._currentNode = node);
      }
    }

    return null;
  }

  nextNode() {
    let node = this._currentNode;
    let result = FILTER_ACCEPT;

    for (;;) {
      while (result !== FILTER_REJECT && node.hasChildNodes()) {
        node = node.firstChild;
        result = this._filterNode(node);
        if (result === FILTER_ACCEPT) {
          return (this._currentNode = node);
        }
      }

      do {
        if (node === this.root) {
          return null;
        }

        const sibling = node.nextSibling;

        if (!isNull(sibling)) {
          node = sibling;
          break;
        }

        node = node.parentNode;
      } while (!isNull(node));

      if (isNull(node)) {
        return null;
      }

      result = this._filterNode(node);

      if (result === FILTER_ACCEPT) {
        return (this._currentNode = node);
      }
    }
  }

  toString() {
    return "[object TreeWalker]";
  }

  _filterNode(node) {
    const n = node.nodeType - 1;

    if (!((1 << n) & this.whatToShow)) {
      return FILTER_SKIP;
    }

    const filter = this.filter;

    if (isNull(filter)) {
      return FILTER_ACCEPT;
    }

    let result;

    if (typeof filter === "function") {
      result = filter(idlUtils.wrapperForImpl(node));
    } else {
      result = filter.acceptNode(idlUtils.wrapperForImpl(node));
    }

    result = conversions["unsigned short"](result);

    return result;
  }

  _traverseChildren(type) {
    let node = this._currentNode;
    node = type === FIRST ? node.firstChild : node.lastChild;

    if (isNull(node)) {
      return null;
    }

    main: for (;;) {
      const result = this._filterNode(node);

      if (result === FILTER_ACCEPT) {
        return (this._currentNode = node);
      }

      if (result === FILTER_SKIP) {
        const child = type === FIRST ? node.firstChild : node.lastChild;

        if (!isNull(child)) {
          node = child;
          continue;
        }
      }

      for (;;) {
        const sibling = type === FIRST ? node.nextSibling : node.previousSibling;

        if (!isNull(sibling)) {
          node = sibling;
          continue main;
        }

        const parent = node.parentNode;

        if (isNull(parent) || parent === this.root || parent === this._currentNode) {
          return null;
        }

        node = parent;
      }
    }
  }

  _traverseSiblings(type) {
    let node = this._currentNode;

    if (node === this.root) {
      return null;
    }

    for (;;) {
      let sibling = type === NEXT ? node.nextSibling : node.previousSibling;

      while (!isNull(sibling)) {
        node = sibling;
        const result = this._filterNode(node);

        if (result === FILTER_ACCEPT) {
          return (this._currentNode = node);
        }

        sibling = type === NEXT ? node.firstChild : node.lastChild;

        if (result === FILTER_REJECT || isNull(sibling)) {
          sibling = type === NEXT ? node.nextSibling : node.previousSibling;
        }
      }

      node = node.parentNode;

      if (isNull(node) || node === this.root) {
        return null;
      }

      if (this._filterNode(node) === FILTER_ACCEPT) {
        return null;
      }
    }
  }
}

module.exports = {
  implementation: TreeWalkerImpl
};
