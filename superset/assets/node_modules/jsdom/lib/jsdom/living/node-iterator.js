"use strict";

const idlUtils = require("./generated/utils");
const domSymbolTree = require("./helpers/internal-constants").domSymbolTree;
const defineGetter = require("../utils").defineGetter;
const INTERNAL = Symbol("NodeIterator internal");
const DocumentImpl = require("./nodes/Document-impl").implementation;

module.exports = function (core) {
  // https://dom.spec.whatwg.org/#interface-nodeiterator

  function NodeIteratorInternal(document, root, whatToShow, filter) {
    this.active = true;
    this.document = document;
    this.root = root;
    this.referenceNode = root;
    this.pointerBeforeReferenceNode = true;
    this.whatToShow = whatToShow;
    this.filter = filter;
  }

  NodeIteratorInternal.prototype.throwIfNotActive = function () {
    // (only thrown for getters/methods that are affected by removing steps)
    if (!this.active) {
      throw Error("This NodeIterator is no longer active. " +
                  "More than " + this.document._activeNodeIteratorsMax +
                  " iterators are being used concurrently. " +
                  "You can increase the 'concurrentNodeIterators' option to " +
                  "make this error go away."
      );
      // Alternatively, you can pester Ecma to add support for weak references,
      // the DOM standard assumes the implementor has control over object life cycles.
    }
  };

  NodeIteratorInternal.prototype.traverse = function (next) {
    let node = this.referenceNode;
    let beforeNode = this.pointerBeforeReferenceNode;

    do {
      if (next) {
        if (!beforeNode) {
          node = domSymbolTree.following(node, { root: this.root });

          if (!node) {
            return null;
          }
        }

        beforeNode = false;
      } else { // previous
        if (beforeNode) {
          node = domSymbolTree.preceding(node, { root: this.root });

          if (!node) {
            return null;
          }
        }

        beforeNode = true;
      }
    }
    while (this.filterNode(node) !== core.NodeFilter.FILTER_ACCEPT);

    this.pointerBeforeReferenceNode = beforeNode;
    this.referenceNode = node;
    return node;
  };

  NodeIteratorInternal.prototype.filterNode = function (node) {
    const n = node.nodeType - 1;
    if (!(this.whatToShow & (1 << n))) {
      return core.NodeFilter.FILTER_SKIP;
    }

    let ret = core.NodeFilter.FILTER_ACCEPT;
    const filter = this.filter;
    if (typeof filter === "function") {
      ret = filter(node);
    } else if (filter && typeof filter.acceptNode === "function") {
      ret = filter.acceptNode(node);
    }

    if (ret === true) {
      return core.NodeFilter.FILTER_ACCEPT;
    } else if (ret === false) {
      return core.NodeFilter.FILTER_REJECT;
    }

    return ret;
  };

  NodeIteratorInternal.prototype.runRemovingSteps = function (oldNode, oldParent, oldPreviousSibling) {
    if (oldNode.contains(this.root)) {
      return;
    }

    // If oldNode is not an inclusive ancestor of the referenceNode
    // attribute value, terminate these steps.
    if (!oldNode.contains(this.referenceNode)) {
      return;
    }

    if (this.pointerBeforeReferenceNode) {
      // Let nextSibling be oldPreviousSibling’s next sibling, if oldPreviousSibling is non-null,
      // and oldParent’s first child otherwise.
      const nextSibling = oldPreviousSibling ?
                          oldPreviousSibling.nextSibling :
                          oldParent.firstChild;

      // If nextSibling is non-null, set the referenceNode attribute to nextSibling
      // and terminate these steps.
      if (nextSibling) {
        this.referenceNode = nextSibling;
        return;
      }

      // Let next be the first node following oldParent (excluding any children of oldParent).
      const next = domSymbolTree.following(oldParent, { skipChildren: true });

      // If root is an inclusive ancestor of next, set the referenceNode
      // attribute to next and terminate these steps.
      if (this.root.contains(next)) {
        this.referenceNode = next;
        return;
      }

      // Otherwise, set the pointerBeforeReferenceNode attribute to false.
      this.pointerBeforeReferenceNode = false;

      // Note: Steps are not terminated here.
    }

    // Set the referenceNode attribute to the last inclusive descendant in tree order of oldPreviousSibling,
    // if oldPreviousSibling is non-null, and to oldParent otherwise.
    this.referenceNode = oldPreviousSibling ?
                             domSymbolTree.lastInclusiveDescendant(oldPreviousSibling) :
                             oldParent;
  };

  DocumentImpl._removingSteps.push((document, oldNode, oldParent, oldPreviousSibling) => {
    for (let i = 0; i < document._activeNodeIterators.length; ++i) {
      const internal = document._activeNodeIterators[i];
      internal.runRemovingSteps(oldNode, oldParent, oldPreviousSibling);
    }
  });

  core.Document.prototype.createNodeIterator = function (root, whatToShow, filter) {
    if (!root) {
      throw new TypeError("Not enough arguments to Document.createNodeIterator.");
    }
    root = idlUtils.implForWrapper(root);

    if (filter === undefined) {
      filter = null;
    }

    if (filter !== null &&
        typeof filter !== "function" &&
        typeof filter.acceptNode !== "function") {
      throw new TypeError("Argument 3 of Document.createNodeIterator should be a function or implement NodeFilter.");
    }

    const document = root._ownerDocument;

    whatToShow = whatToShow === undefined ?
      core.NodeFilter.SHOW_ALL :
      (whatToShow & core.NodeFilter.SHOW_ALL) >>> 0; // >>> makes sure the result is unsigned

    filter = filter || null;

    const it = Object.create(core.NodeIterator.prototype);
    const internal = new NodeIteratorInternal(document, root, whatToShow, filter);
    it[INTERNAL] = internal;

    document._activeNodeIterators.push(internal);
    while (document._activeNodeIterators.length > document._activeNodeIteratorsMax) {
      const internalOther = document._activeNodeIterators.shift();
      internalOther.active = false;
    }

    return it;
  };

  core.NodeIterator = function NodeIterator() {
    throw new TypeError("Illegal constructor");
  };

  defineGetter(core.NodeIterator.prototype, "root", function () {
    return idlUtils.wrapperForImpl(this[INTERNAL].root);
  });

  defineGetter(core.NodeIterator.prototype, "referenceNode", function () {
    const internal = this[INTERNAL];
    internal.throwIfNotActive();
    return idlUtils.wrapperForImpl(internal.referenceNode);
  });

  defineGetter(core.NodeIterator.prototype, "pointerBeforeReferenceNode", function () {
    const internal = this[INTERNAL];
    internal.throwIfNotActive();
    return internal.pointerBeforeReferenceNode;
  });

  defineGetter(core.NodeIterator.prototype, "whatToShow", function () {
    return this[INTERNAL].whatToShow;
  });

  defineGetter(core.NodeIterator.prototype, "filter", function () {
    return this[INTERNAL].filter;
  });

  core.NodeIterator.prototype.previousNode = function () {
    const internal = this[INTERNAL];
    internal.throwIfNotActive();
    return idlUtils.wrapperForImpl(internal.traverse(false));
  };

  core.NodeIterator.prototype.nextNode = function () {
    const internal = this[INTERNAL];
    internal.throwIfNotActive();
    return idlUtils.wrapperForImpl(internal.traverse(true));
  };

  core.NodeIterator.prototype.detach = function () {
    // noop
  };

  core.NodeIterator.prototype.toString = function () {
    return "[object NodeIterator]";
  };
};
