"use strict";

exports.__esModule = true;
exports.default = void 0;

function one(h, node, parent) {
  const type = node && node.type;
  const fn = h.handlers[type];
  /* Fail on non-nodes. */

  if (!type) {
    throw new Error(`Expected node, got \`${node}\``);
  }

  if (!fn) {
    throw new Error(`Node of type ${type} is unknown`);
  }

  return fn(h, node, parent);
}

var _default = one;
exports.default = _default;