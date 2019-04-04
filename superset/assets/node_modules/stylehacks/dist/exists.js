"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = exists;
function exists(selector, index, value) {
    const node = selector.at(index);
    return node && node.value === value;
}
module.exports = exports["default"];