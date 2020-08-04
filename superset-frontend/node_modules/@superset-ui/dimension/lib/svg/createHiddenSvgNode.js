"use strict";

exports.__esModule = true;
exports.default = createHiddenSvgNode;

var _constants = require("./constants");

function createHiddenSvgNode() {
  const svgNode = document.createElementNS(_constants.SVG_NS, 'svg');
  svgNode.style.position = 'absolute'; // so it won't disrupt page layout

  svgNode.style.top = '-100%';
  svgNode.style.left = '-100%';
  svgNode.style.width = '0'; // no dimensions

  svgNode.style.height = '0';
  svgNode.style.opacity = '0'; // not visible

  svgNode.style.pointerEvents = 'none'; // won't capture mouse events

  return svgNode;
}