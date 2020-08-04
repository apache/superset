"use strict";

exports.__esModule = true;
exports.default = qsa;
var toArray = Function.prototype.bind.call(Function.prototype.call, [].slice);

function qsa(element, selector) {
  return toArray(element.querySelectorAll(selector));
}

module.exports = exports["default"];