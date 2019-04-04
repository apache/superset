"use strict";

const idlUtils = require("../generated/utils");
const nwmatcher = require("nwmatcher/src/nwmatcher-noqsa");
const domSymbolTree = require("./internal-constants").domSymbolTree;

// Internal method so you don't have to go through the public API
exports.querySelector = function (parentNode, selectors) {
  if (!domSymbolTree.hasChildren(parentNode) ||
      (parentNode === parentNode._ownerDocument && !parentNode.documentElement)) {
    // This allows us to avoid the explosion that occurs if you try to add nwmatcher to a document that is not yet
    // initialized.
    return null;
  }

  return addNwmatcher(parentNode).first(selectors, idlUtils.wrapperForImpl(parentNode));
};

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
