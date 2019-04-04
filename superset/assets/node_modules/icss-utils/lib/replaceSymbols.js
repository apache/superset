"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _replaceValueSymbols = require("./replaceValueSymbols.js");

var _replaceValueSymbols2 = _interopRequireDefault(_replaceValueSymbols);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var replaceSymbols = function replaceSymbols(css, replacements) {
  css.walk(function (node) {
    if (node.type === "decl") {
      node.value = (0, _replaceValueSymbols2.default)(node.value, replacements);
    } else if (node.type === "rule") {
      node.selector = (0, _replaceValueSymbols2.default)(node.selector, replacements);
    } else if (node.type === "atrule" && node.name === "media") {
      node.params = (0, _replaceValueSymbols2.default)(node.params, replacements);
    }
  });
};

exports.default = replaceSymbols;