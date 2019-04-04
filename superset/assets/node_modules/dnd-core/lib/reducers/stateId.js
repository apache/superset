"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = stateId;
function stateId() {
	var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

	return state + 1;
}