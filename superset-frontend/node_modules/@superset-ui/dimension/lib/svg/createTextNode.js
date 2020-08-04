"use strict";

exports.__esModule = true;
exports.default = createTextNode;

var _constants = require("./constants");

function createTextNode() {
  return document.createElementNS(_constants.SVG_NS, 'text');
}