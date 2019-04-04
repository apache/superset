'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.getNodeClientOffset = getNodeClientOffset;
exports.getEventClientOffset = getEventClientOffset;
exports.getDragPreviewOffset = getDragPreviewOffset;

var _BrowserDetector = require('./BrowserDetector');

var _MonotonicInterpolant = require('./MonotonicInterpolant');

var _MonotonicInterpolant2 = _interopRequireDefault(_MonotonicInterpolant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint
   no-mixed-operators: off
*/
var ELEMENT_NODE = 1;

function getNodeClientOffset(node) {
	var el = node.nodeType === ELEMENT_NODE ? node : node.parentElement;

	if (!el) {
		return null;
	}

	var _el$getBoundingClient = el.getBoundingClientRect(),
	    top = _el$getBoundingClient.top,
	    left = _el$getBoundingClient.left;

	return { x: left, y: top };
}

function getEventClientOffset(e) {
	return {
		x: e.clientX,
		y: e.clientY
	};
}

function isImageNode(node) {
	return node.nodeName === 'IMG' && ((0, _BrowserDetector.isFirefox)() || !document.documentElement.contains(node));
}

function getDragPreviewSize(isImage, dragPreview, sourceWidth, sourceHeight) {
	var dragPreviewWidth = isImage ? dragPreview.width : sourceWidth;
	var dragPreviewHeight = isImage ? dragPreview.height : sourceHeight;

	// Work around @2x coordinate discrepancies in browsers
	if ((0, _BrowserDetector.isSafari)() && isImage) {
		dragPreviewHeight /= window.devicePixelRatio;
		dragPreviewWidth /= window.devicePixelRatio;
	}
	return { dragPreviewWidth: dragPreviewWidth, dragPreviewHeight: dragPreviewHeight };
}

function getDragPreviewOffset(sourceNode, dragPreview, clientOffset, anchorPoint, offsetPoint) {
	// The browsers will use the image intrinsic size under different conditions.
	// Firefox only cares if it's an image, but WebKit also wants it to be detached.
	var isImage = isImageNode(dragPreview);
	var dragPreviewNode = isImage ? sourceNode : dragPreview;
	var dragPreviewNodeOffsetFromClient = getNodeClientOffset(dragPreviewNode);
	var offsetFromDragPreview = {
		x: clientOffset.x - dragPreviewNodeOffsetFromClient.x,
		y: clientOffset.y - dragPreviewNodeOffsetFromClient.y
	};
	var sourceWidth = sourceNode.offsetWidth,
	    sourceHeight = sourceNode.offsetHeight;
	var anchorX = anchorPoint.anchorX,
	    anchorY = anchorPoint.anchorY;

	var _getDragPreviewSize = getDragPreviewSize(isImage, dragPreview, sourceWidth, sourceHeight),
	    dragPreviewWidth = _getDragPreviewSize.dragPreviewWidth,
	    dragPreviewHeight = _getDragPreviewSize.dragPreviewHeight;

	var calculateYOffset = function calculateYOffset() {
		var interpolantY = new _MonotonicInterpolant2.default([0, 0.5, 1], [
		// Dock to the top
		offsetFromDragPreview.y,
		// Align at the center
		offsetFromDragPreview.y / sourceHeight * dragPreviewHeight,
		// Dock to the bottom
		offsetFromDragPreview.y + dragPreviewHeight - sourceHeight]);
		var y = interpolantY.interpolate(anchorY);
		// Work around Safari 8 positioning bug
		if ((0, _BrowserDetector.isSafari)() && isImage) {
			// We'll have to wait for @3x to see if this is entirely correct
			y += (window.devicePixelRatio - 1) * dragPreviewHeight;
		}
		return y;
	};

	var calculateXOffset = function calculateXOffset() {
		// Interpolate coordinates depending on anchor point
		// If you know a simpler way to do this, let me know
		var interpolantX = new _MonotonicInterpolant2.default([0, 0.5, 1], [
		// Dock to the left
		offsetFromDragPreview.x,
		// Align at the center
		offsetFromDragPreview.x / sourceWidth * dragPreviewWidth,
		// Dock to the right
		offsetFromDragPreview.x + dragPreviewWidth - sourceWidth]);
		return interpolantX.interpolate(anchorX);
	};

	// Force offsets if specified in the options.
	var offsetX = offsetPoint.offsetX,
	    offsetY = offsetPoint.offsetY;

	var isManualOffsetX = offsetX === 0 || offsetX;
	var isManualOffsetY = offsetY === 0 || offsetY;
	return {
		x: isManualOffsetX ? offsetX : calculateXOffset(),
		y: isManualOffsetY ? offsetY : calculateYOffset()
	};
}