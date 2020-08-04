"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = getNextUniqueId;
var nextUniqueId = 0;

function getNextUniqueId() {
	return nextUniqueId++;
}