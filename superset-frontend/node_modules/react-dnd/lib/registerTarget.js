"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = registerTarget;
function registerTarget(type, target, manager) {
	var registry = manager.getRegistry();
	var targetId = registry.addTarget(type, target);

	function unregisterTarget() {
		registry.removeTarget(targetId);
	}

	return {
		handlerId: targetId,
		unregister: unregisterTarget
	};
}