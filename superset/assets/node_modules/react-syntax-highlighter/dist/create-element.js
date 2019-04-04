'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

exports.createStyleObject = createStyleObject;
exports.createClassNameString = createClassNameString;
exports.createChildren = createChildren;
exports.default = createElement;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createStyleObject(classNames) {
  var elementStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var stylesheet = arguments[2];

  return classNames.reduce(function (styleObject, className) {
    return (0, _extends3.default)({}, styleObject, stylesheet[className]);
  }, elementStyle);
}

function createClassNameString(classNames) {
  return classNames.join(' ');
}

function createChildren(stylesheet, useInlineStyles) {
  var childrenCount = 0;
  return function (children) {
    childrenCount += 1;
    return children.map(function (child, i) {
      return createElement({
        node: child,
        stylesheet: stylesheet,
        useInlineStyles: useInlineStyles,
        key: 'code-segment-' + childrenCount + '-' + i
      });
    });
  };
}

function createElement(_ref) {
  var node = _ref.node,
      stylesheet = _ref.stylesheet,
      _ref$style = _ref.style,
      style = _ref$style === undefined ? {} : _ref$style,
      useInlineStyles = _ref.useInlineStyles,
      key = _ref.key;
  var properties = node.properties,
      type = node.type,
      TagName = node.tagName,
      value = node.value;

  if (type === 'text') {
    return value;
  } else if (TagName) {
    var childrenCreator = createChildren(stylesheet, useInlineStyles);
    var props = useInlineStyles ? {
      style: createStyleObject(properties.className, (0, _assign2.default)({}, properties.style, style), stylesheet)
    } : { className: createClassNameString(properties.className) };
    var children = childrenCreator(node.children);
    return _react2.default.createElement(
      TagName,
      (0, _extends3.default)({ key: key }, props),
      children
    );
  }
}