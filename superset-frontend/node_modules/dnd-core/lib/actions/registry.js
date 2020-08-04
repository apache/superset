'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.addSource = addSource;
exports.addTarget = addTarget;
exports.removeSource = removeSource;
exports.removeTarget = removeTarget;
var ADD_SOURCE = exports.ADD_SOURCE = 'dnd-core/ADD_SOURCE';
var ADD_TARGET = exports.ADD_TARGET = 'dnd-core/ADD_TARGET';
var REMOVE_SOURCE = exports.REMOVE_SOURCE = 'dnd-core/REMOVE_SOURCE';
var REMOVE_TARGET = exports.REMOVE_TARGET = 'dnd-core/REMOVE_TARGET';

function addSource(sourceId) {
	return {
		type: ADD_SOURCE,
		sourceId: sourceId
	};
}

function addTarget(targetId) {
	return {
		type: ADD_TARGET,
		targetId: targetId
	};
}

function removeSource(sourceId) {
	return {
		type: REMOVE_SOURCE,
		sourceId: sourceId
	};
}

function removeTarget(targetId) {
	return {
		type: REMOVE_TARGET,
		targetId: targetId
	};
}