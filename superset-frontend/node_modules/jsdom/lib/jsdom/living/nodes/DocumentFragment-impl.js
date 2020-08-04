"use strict";

const idlUtils = require("../generated/utils");
const NodeImpl = require("./Node-impl").implementation;
const ParentNodeImpl = require("./ParentNode-impl").implementation;

const NODE_TYPE = require("../node-type");

class DocumentFragmentImpl extends NodeImpl {
  constructor(args, privateData) {
    super(args, privateData);

    this.nodeType = NODE_TYPE.DOCUMENT_FRAGMENT_NODE;
  }
}

idlUtils.mixin(DocumentFragmentImpl.prototype, ParentNodeImpl.prototype);

module.exports = {
  implementation: DocumentFragmentImpl
};
