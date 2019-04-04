"use strict";

const idlUtils = require("../generated/utils");

const nwmatcher = require("nwmatcher/src/nwmatcher-noqsa");
const DOMException = require("../../web-idl/DOMException");
const domSymbolTree = require("../helpers/internal-constants").domSymbolTree;
const NODE_TYPE = require("../node-type");
const createHTMLCollection = require("../html-collection").create;
const updateHTMLCollection = require("../html-collection").update;
const memoizeQuery = require("../../utils").memoizeQuery;
const createStaticNodeList = require("../node-list").createStatic;

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

class ParentNodeImpl {
  get children() {
    if (!this._childrenList) {
      this._childrenList = createHTMLCollection(this, () => {
        return domSymbolTree.childrenToArray(this, { filter(node) {
          return node.nodeType === NODE_TYPE.ELEMENT_NODE;
        } });
      });
    } else {
      updateHTMLCollection(this._childrenList);
    }
    return this._childrenList;
  }

  get firstElementChild() {
    for (const child of domSymbolTree.childrenIterator(this)) {
      if (child.nodeType === NODE_TYPE.ELEMENT_NODE) {
        return child;
      }
    }

    return null;
  }

  get lastElementChild() {
    for (const child of domSymbolTree.childrenIterator(this, { reverse: true })) {
      if (child.nodeType === NODE_TYPE.ELEMENT_NODE) {
        return child;
      }
    }

    return null;
  }

  get childElementCount() {
    return this.children.length;
  }
}

ParentNodeImpl.prototype.querySelector = memoizeQuery(function (selectors) {
  const matcher = addNwmatcher(this);

  try {
    return matcher.first(selectors, idlUtils.wrapperForImpl(this));
  } catch (e) {
    throw new DOMException(DOMException.SYNTAX_ERR, e.message);
  }
});

ParentNodeImpl.prototype.querySelectorAll = memoizeQuery(function (selectors) {
  const matcher = addNwmatcher(this);

  let list;
  try {
    list = matcher.select(selectors, idlUtils.wrapperForImpl(this));
  } catch (e) {
    throw new DOMException(DOMException.SYNTAX_ERR, e.message);
  }

  return createStaticNodeList(list);
});

module.exports = {
  implementation: ParentNodeImpl
};
