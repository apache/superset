"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeUnnecessaryItems = removeUnnecessaryItems;

function removeUnnecessaryItems(items, overlapping) {
  items.forEach(item => {
    var _overlapping$item;

    (_overlapping$item = overlapping[item]) == null ? void 0 : _overlapping$item.forEach(name => items.delete(name));
  });
}