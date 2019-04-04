'use strict';

exports.__esModule = true;

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Label = function (_React$Component) {
  (0, _inherits3.default)(Label, _React$Component);

  function Label() {
    (0, _classCallCheck3.default)(this, Label);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Label.prototype.hasContent = function hasContent(children) {
    var result = false;

    _react2.default.Children.forEach(children, function (child) {
      if (result) {
        return;
      }

      if (child || child === 0) {
        result = true;
      }
    });

    return result;
  };

  Label.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {

      // Hack for collapsing on IE8.
      hidden: !this.hasContent(children)
    });

    return _react2.default.createElement(
      'span',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      children
    );
  };

  return Label;
}(_react2.default.Component);

exports.default = (0, _bootstrapUtils.bsClass)('label', (0, _bootstrapUtils.bsStyles)([].concat((0, _values2.default)(_StyleConfig.State), [_StyleConfig.Style.DEFAULT, _StyleConfig.Style.PRIMARY]), _StyleConfig.Style.DEFAULT, Label));
module.exports = exports['default'];