'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

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

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * A css class to apply to the Modal dialog DOM node.
   */
  dialogClassName: _propTypes2.default.string
};

var ModalDialog = function (_React$Component) {
  (0, _inherits3.default)(ModalDialog, _React$Component);

  function ModalDialog() {
    (0, _classCallCheck3.default)(this, ModalDialog);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  ModalDialog.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        dialogClassName = _props.dialogClassName,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['dialogClassName', 'className', 'style', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var bsClassName = (0, _bootstrapUtils.prefix)(bsProps);

    var modalStyle = (0, _extends4.default)({ display: 'block' }, style);

    var dialogClasses = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[bsClassName] = false, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'dialog')] = true, _extends2));

    return _react2.default.createElement(
      'div',
      (0, _extends4.default)({}, elementProps, {
        tabIndex: '-1',
        role: 'dialog',
        style: modalStyle,
        className: (0, _classnames2.default)(className, bsClassName)
      }),
      _react2.default.createElement(
        'div',
        { className: (0, _classnames2.default)(dialogClassName, dialogClasses) },
        _react2.default.createElement(
          'div',
          { className: (0, _bootstrapUtils.prefix)(bsProps, 'content'), role: 'document' },
          children
        )
      )
    );
  };

  return ModalDialog;
}(_react2.default.Component);

ModalDialog.propTypes = propTypes;

exports.default = (0, _bootstrapUtils.bsClass)('modal', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.LARGE, _StyleConfig.Size.SMALL], ModalDialog));
module.exports = exports['default'];