'use strict';

exports.__esModule = true;

var _omit = require('./utils/omit');

var _omit2 = _interopRequireDefault(_omit);

var _createEagerElement = require('./createEagerElement');

var _createEagerElement2 = _interopRequireDefault(_createEagerElement);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var componentFromProp = function componentFromProp(propName) {
  var Component = function Component(props) {
    return (0, _createEagerElement2.default)(props[propName], (0, _omit2.default)(props, [propName]));
  };
  Component.displayName = 'componentFromProp(' + propName + ')';
  return Component;
};

exports.default = componentFromProp;