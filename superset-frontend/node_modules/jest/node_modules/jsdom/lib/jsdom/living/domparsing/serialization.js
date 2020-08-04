"use strict";

const { produceXMLSerialization } = require("w3c-xmlserializer");
const parse5 = require("parse5");

const utils = require("../generated/utils");
const treeAdapter = require("./parse5-adapter-serialization");
const NODE_TYPE = require("../node-type");
const NAMESPACES = require("../helpers/namespaces");

function htmlSerialization(node) {
  if (
    node.nodeType === NODE_TYPE.ELEMENT_NODE &&
    node.namespaceURI === NAMESPACES.HTML_NS &&
    node.tagName === "TEMPLATE"
  ) {
    node = node.content;
  }

  return parse5.serialize(node, { treeAdapter });
}

module.exports.fragmentSerialization = (node, { requireWellFormed }) => {
  const contextDocument =
    node.nodeType === NODE_TYPE.DOCUMENT_NODE ? node : node._ownerDocument;
  if (contextDocument._parsingMode === "html") {
    return htmlSerialization(node);
  }

  const childNodes = node.childNodesForSerializing || node.childNodes;
  let serialized = "";
  for (let i = 0; i < childNodes.length; ++i) {
    serialized += produceXMLSerialization(
      utils.wrapperForImpl(childNodes[i] || childNodes.item(i)),
      requireWellFormed
    );
  }
  return serialized;
};
