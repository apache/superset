"use strict";

exports.__esModule = true;
exports.default = mergeMargin;

function mergeOneSide(operation, a = 0, b = 0) {
  if (Number.isNaN(a) || a === null) return b;
  if (Number.isNaN(b) || b === null) return a;
  return operation(a, b);
}

function mergeMargin(margin1 = {}, margin2 = {}, mode = 'expand') {
  const {
    top,
    left,
    bottom,
    right
  } = margin1;
  const operation = mode === 'expand' ? Math.max : Math.min;
  return {
    bottom: mergeOneSide(operation, bottom, margin2.bottom),
    left: mergeOneSide(operation, left, margin2.left),
    right: mergeOneSide(operation, right, margin2.right),
    top: mergeOneSide(operation, top, margin2.top)
  };
}