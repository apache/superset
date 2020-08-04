'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = wrapConnectorHooks;

var _react = require('react');

var _cloneWithRef = require('./utils/cloneWithRef');

var _cloneWithRef2 = _interopRequireDefault(_cloneWithRef);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function throwIfCompositeComponentElement(element) {
	// Custom components can no longer be wrapped directly in React DnD 2.0
	// so that we don't need to depend on findDOMNode() from react-dom.
	if (typeof element.type === 'string') {
		return;
	}

	var displayName = element.type.displayName || element.type.name || 'the component';

	throw new Error('Only native element nodes can now be passed to React DnD connectors.' + ('You can either wrap ' + displayName + ' into a <div>, or turn it into a ') + 'drag source or a drop target itself.');
}

function wrapHookToRecognizeElement(hook) {
	return function () {
		var elementOrNode = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
		var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

		// When passed a node, call the hook straight away.
		if (!(0, _react.isValidElement)(elementOrNode)) {
			var node = elementOrNode;
			hook(node, options);
			return undefined;
		}

		// If passed a ReactElement, clone it and attach this function as a ref.
		// This helps us achieve a neat API where user doesn't even know that refs
		// are being used under the hood.
		var element = elementOrNode;
		throwIfCompositeComponentElement(element);

		// When no options are passed, use the hook directly
		var ref = options ? function (node) {
			return hook(node, options);
		} : hook;

		return (0, _cloneWithRef2.default)(element, ref);
	};
}

function wrapConnectorHooks(hooks) {
	var wrappedHooks = {};

	Object.keys(hooks).forEach(function (key) {
		var hook = hooks[key];
		var wrappedHook = wrapHookToRecognizeElement(hook);
		wrappedHooks[key] = function () {
			return wrappedHook;
		};
	});

	return wrappedHooks;
}