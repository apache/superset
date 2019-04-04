'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = cloneWithRef;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _react = require('react');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cloneWithRef(element, newRef) {
	var previousRef = element.ref;
	(0, _invariant2.default)(typeof previousRef !== 'string', 'Cannot connect React DnD to an element with an existing string ref. ' + 'Please convert it to use a callback ref instead, or wrap it into a <span> or <div>. ' + 'Read more: https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute');

	if (!previousRef) {
		// When there is no ref on the element, use the new ref directly
		return (0, _react.cloneElement)(element, {
			ref: newRef
		});
	}

	return (0, _react.cloneElement)(element, {
		ref: function ref(node) {
			newRef(node);

			if (previousRef) {
				previousRef(node);
			}
		}
	});
}