"use strict";
const parse5 = require("parse5");
const documentAdapter = require("./documentAdapter");
const NODE_TYPE = require("../living/node-type");
const idlUtils = require("../living/generated/utils");

const serializer = new parse5.TreeSerializer(documentAdapter);

exports.domToHtml = function (iterable) {
  let ret = "";
  for (const node of iterable) {
    if (node.nodeType === NODE_TYPE.DOCUMENT_NODE) {
      ret += serializer.serialize(node);
    } else {
      ret += serializer.serialize({ childNodes: [idlUtils.wrapperForImpl(node)] });
    }
  }
  return ret;
};
