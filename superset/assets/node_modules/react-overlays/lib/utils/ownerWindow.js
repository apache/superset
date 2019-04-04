'use strict';

exports.__esModule = true;

exports.default = function (componentOrElement) {
  return (0, _ownerWindow2.default)(_reactDom2.default.findDOMNode(componentOrElement));
};

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _ownerWindow = require('dom-helpers/ownerWindow');

var _ownerWindow2 = _interopRequireDefault(_ownerWindow);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];