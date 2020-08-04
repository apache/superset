"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = registerSource;
function registerSource(type, source, manager) {
	var registry = manager.getRegistry();
	var sourceId = registry.addSource(type, source);

	function unregisterSource() {
		registry.removeSource(sourceId);
	}

	return {
		handlerId: sourceId,
		unregister: unregisterSource
	};
}