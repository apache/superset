'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _Glyphicon = require('./Glyphicon');

var _Glyphicon2 = _interopRequireDefault(_Glyphicon);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defaultProps = {
  bsRole: 'feedback'
};

var contextTypes = {
  $bs_formGroup: _propTypes2.default.object
};

var FormControlFeedback = function (_React$Component) {
  (0, _inherits3.default)(FormControlFeedback, _React$Component);

  function FormControlFeedback() {
    (0, _classCallCheck3.default)(this, FormControlFeedback);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  FormControlFeedback.prototype.getGlyph = function getGlyph(validationState) {
    switch (validationState) {
      case 'success':
        return 'ok';
      case 'warning':
        return 'warning-sign';
      case 'error':
        return 'remove';
      default:
        return null;
    }
  };

  FormControlFeedback.prototype.renderDefaultFeedback = function renderDefaultFeedback(formGroup, className, classes, elementProps) {
    var glyph = this.getGlyph(formGroup && formGroup.validationState);
    if (!glyph) {
      return null;
    }

    return _react2.default.createElement(_Glyphicon2.default, (0, _extends3.default)({}, elementProps, {
      glyph: glyph,
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  FormControlFeedback.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    if (!children) {
      return this.renderDefaultFeedback(this.context.$bs_formGroup, className, classes, elementProps);
    }

    var child = _react2.default.Children.only(children);
    return _react2.default.cloneElement(child, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(child.props.className, className, classes)
    }));
  };

  return FormControlFeedback;
}(_react2.default.Component);

FormControlFeedback.defaultProps = defaultProps;
FormControlFeedback.contextTypes = contextTypes;

exports.default = (0, _bootstrapUtils.bsClass)('form-control-feedback', FormControlFeedback);
module.exports = exports['default'];