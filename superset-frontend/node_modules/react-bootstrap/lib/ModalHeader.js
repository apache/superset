"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _CloseButton = _interopRequireDefault(require("./CloseButton"));

// TODO: `aria-label` should be `closeLabel`.
var propTypes = {
  /**
   * Provides an accessible label for the close
   * button. It is used for Assistive Technology when the label text is not
   * readable.
   */
  closeLabel: _propTypes.default.string,

  /**
   * Specify whether the Component should contain a close button
   */
  closeButton: _propTypes.default.bool,

  /**
   * A Callback fired when the close button is clicked. If used directly inside
   * a Modal component, the onHide will automatically be propagated up to the
   * parent Modal `onHide`.
   */
  onHide: _propTypes.default.func
};
var defaultProps = {
  closeLabel: 'Close',
  closeButton: false
};
var contextTypes = {
  $bs_modal: _propTypes.default.shape({
    onHide: _propTypes.default.func
  })
};

var ModalHeader =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(ModalHeader, _React$Component);

  function ModalHeader() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = ModalHeader.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        closeLabel = _this$props.closeLabel,
        closeButton = _this$props.closeButton,
        onHide = _this$props.onHide,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["closeLabel", "closeButton", "onHide", "className", "children"]);
    var modal = this.context.$bs_modal;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), closeButton && _react.default.createElement(_CloseButton.default, {
      label: closeLabel,
      onClick: (0, _createChainedFunction.default)(modal && modal.onHide, onHide)
    }), children);
  };

  return ModalHeader;
}(_react.default.Component);

ModalHeader.propTypes = propTypes;
ModalHeader.defaultProps = defaultProps;
ModalHeader.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('modal-header', ModalHeader);

exports.default = _default;
module.exports = exports["default"];