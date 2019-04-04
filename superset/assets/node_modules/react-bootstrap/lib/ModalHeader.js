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

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

var _CloseButton = require('./CloseButton');

var _CloseButton2 = _interopRequireDefault(_CloseButton);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: `aria-label` should be `closeLabel`.

var propTypes = {
  /**
   * Provides an accessible label for the close
   * button. It is used for Assistive Technology when the label text is not
   * readable.
   */
  closeLabel: _propTypes2.default.string,

  /**
   * Specify whether the Component should contain a close button
   */
  closeButton: _propTypes2.default.bool,

  /**
   * A Callback fired when the close button is clicked. If used directly inside
   * a Modal component, the onHide will automatically be propagated up to the
   * parent Modal `onHide`.
   */
  onHide: _propTypes2.default.func
};

var defaultProps = {
  closeLabel: 'Close',
  closeButton: false
};

var contextTypes = {
  $bs_modal: _propTypes2.default.shape({
    onHide: _propTypes2.default.func
  })
};

var ModalHeader = function (_React$Component) {
  (0, _inherits3.default)(ModalHeader, _React$Component);

  function ModalHeader() {
    (0, _classCallCheck3.default)(this, ModalHeader);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  ModalHeader.prototype.render = function render() {
    var _props = this.props,
        closeLabel = _props.closeLabel,
        closeButton = _props.closeButton,
        onHide = _props.onHide,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['closeLabel', 'closeButton', 'onHide', 'className', 'children']);


    var modal = this.context.$bs_modal;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement(
      'div',
      (0, _extends3.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, classes)
      }),
      closeButton && _react2.default.createElement(_CloseButton2.default, {
        label: closeLabel,
        onClick: (0, _createChainedFunction2.default)(modal && modal.onHide, onHide)
      }),
      children
    );
  };

  return ModalHeader;
}(_react2.default.Component);

ModalHeader.propTypes = propTypes;
ModalHeader.defaultProps = defaultProps;
ModalHeader.contextTypes = contextTypes;

exports.default = (0, _bootstrapUtils.bsClass)('modal-header', ModalHeader);
module.exports = exports['default'];