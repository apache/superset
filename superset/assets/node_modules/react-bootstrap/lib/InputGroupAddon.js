'use strict';

exports.__esModule = true;

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var InputGroupAddon = function (_React$Component) {
  (0, _inherits3.default)(InputGroupAddon, _React$Component);

  function InputGroupAddon() {
    (0, _classCallCheck3.default)(this, InputGroupAddon);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  InputGroupAddon.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement('span', (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return InputGroupAddon;
}(_react2.default.Component);

exports.default = (0, _bootstrapUtils.bsClass)('input-group-addon', InputGroupAddon);
module.exports = exports['default'];