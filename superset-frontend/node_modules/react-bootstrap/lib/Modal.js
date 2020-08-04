"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _classnames = _interopRequireDefault(require("classnames"));

var _events = _interopRequireDefault(require("dom-helpers/events"));

var _ownerDocument = _interopRequireDefault(require("dom-helpers/ownerDocument"));

var _inDOM = _interopRequireDefault(require("dom-helpers/util/inDOM"));

var _scrollbarSize = _interopRequireDefault(require("dom-helpers/util/scrollbarSize"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _reactDom = _interopRequireDefault(require("react-dom"));

var _Modal = _interopRequireDefault(require("react-overlays/lib/Modal"));

var _isOverflowing = _interopRequireDefault(require("react-overlays/lib/utils/isOverflowing"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _Fade = _interopRequireDefault(require("./Fade"));

var _ModalBody = _interopRequireDefault(require("./ModalBody"));

var _ModalDialog = _interopRequireDefault(require("./ModalDialog"));

var _ModalFooter = _interopRequireDefault(require("./ModalFooter"));

var _ModalHeader = _interopRequireDefault(require("./ModalHeader"));

var _ModalTitle = _interopRequireDefault(require("./ModalTitle"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _splitComponentProps2 = _interopRequireDefault(require("./utils/splitComponentProps"));

var _StyleConfig = require("./utils/StyleConfig");

var propTypes = (0, _extends2.default)({}, _Modal.default.propTypes, _ModalDialog.default.propTypes, {
  /**
   * Include a backdrop component. Specify 'static' for a backdrop that doesn't
   * trigger an "onHide" when clicked.
   */
  backdrop: _propTypes.default.oneOf(['static', true, false]),

  /**
   * Add an optional extra class name to .modal-backdrop
   * It could end up looking like class="modal-backdrop foo-modal-backdrop in".
   */
  backdropClassName: _propTypes.default.string,

  /**
   * Close the modal when escape key is pressed
   */
  keyboard: _propTypes.default.bool,

  /**
   * Open and close the Modal with a slide and fade animation.
   */
  animation: _propTypes.default.bool,

  /**
   * A Component type that provides the modal content Markup. This is a useful
   * prop when you want to use your own styles and markup to create a custom
   * modal component.
   */
  dialogComponentClass: _elementType.default,

  /**
   * When `true` The modal will automatically shift focus to itself when it
   * opens, and replace it to the last focused element when it closes.
   * Generally this should never be set to false as it makes the Modal less
   * accessible to assistive technologies, like screen-readers.
   */
  autoFocus: _propTypes.default.bool,

  /**
   * When `true` The modal will prevent focus from leaving the Modal while
   * open. Consider leaving the default value here, as it is necessary to make
   * the Modal work well with assistive technologies, such as screen readers.
   */
  enforceFocus: _propTypes.default.bool,

  /**
   * When `true` The modal will restore focus to previously focused element once
   * modal is hidden
   */
  restoreFocus: _propTypes.default.bool,

  /**
   * When `true` The modal will show itself.
   */
  show: _propTypes.default.bool,

  /**
   * A callback fired when the header closeButton or non-static backdrop is
   * clicked. Required if either are specified.
   */
  onHide: _propTypes.default.func,

  /**
   * Callback fired before the Modal transitions in
   */
  onEnter: _propTypes.default.func,

  /**
   * Callback fired as the Modal begins to transition in
   */
  onEntering: _propTypes.default.func,

  /**
   * Callback fired after the Modal finishes transitioning in
   */
  onEntered: _propTypes.default.func,

  /**
   * Callback fired right before the Modal transitions out
   */
  onExit: _propTypes.default.func,

  /**
   * Callback fired as the Modal begins to transition out
   */
  onExiting: _propTypes.default.func,

  /**
   * Callback fired after the Modal finishes transitioning out
   */
  onExited: _propTypes.default.func,

  /**
   * @private
   */
  container: _Modal.default.propTypes.container
});
var defaultProps = (0, _extends2.default)({}, _Modal.default.defaultProps, {
  animation: true,
  dialogComponentClass: _ModalDialog.default
});
var childContextTypes = {
  $bs_modal: _propTypes.default.shape({
    onHide: _propTypes.default.func
  })
};
/* eslint-disable no-use-before-define, react/no-multi-comp */

function DialogTransition(props) {
  return _react.default.createElement(_Fade.default, (0, _extends2.default)({}, props, {
    timeout: Modal.TRANSITION_DURATION
  }));
}

function BackdropTransition(props) {
  return _react.default.createElement(_Fade.default, (0, _extends2.default)({}, props, {
    timeout: Modal.BACKDROP_TRANSITION_DURATION
  }));
}
/* eslint-enable no-use-before-define */


var Modal =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Modal, _React$Component);

  function Modal(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;

    _this.handleDialogBackdropMouseDown = function () {
      _this._waitingForMouseUp = true;
    };

    _this.handleMouseUp = function (ev) {
      var dialogNode = _this._modal.getDialogElement();

      if (_this._waitingForMouseUp && ev.target === dialogNode) {
        _this._ignoreBackdropClick = true;
      }

      _this._waitingForMouseUp = false;
    };

    _this.handleEntering = _this.handleEntering.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleExited = _this.handleExited.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleWindowResize = _this.handleWindowResize.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.handleDialogClick = _this.handleDialogClick.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.setModalRef = _this.setModalRef.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    _this.state = {
      style: {}
    };
    return _this;
  }

  var _proto = Modal.prototype;

  _proto.getChildContext = function getChildContext() {
    return {
      $bs_modal: {
        onHide: this.props.onHide
      }
    };
  };

  _proto.componentWillUnmount = function componentWillUnmount() {
    // Clean up the listener if we need to.
    this.handleExited();
  };

  _proto.setModalRef = function setModalRef(ref) {
    this._modal = ref;
  };

  _proto.handleDialogClick = function handleDialogClick(e) {
    if (this._ignoreBackdropClick || e.target !== e.currentTarget) {
      this._ignoreBackdropClick = false;
      return;
    }

    this.props.onHide();
  };

  _proto.handleEntering = function handleEntering() {
    // FIXME: This should work even when animation is disabled.
    _events.default.on(window, 'resize', this.handleWindowResize);

    this.updateStyle();
  };

  _proto.handleExited = function handleExited() {
    // FIXME: This should work even when animation is disabled.
    _events.default.off(window, 'resize', this.handleWindowResize);
  };

  _proto.handleWindowResize = function handleWindowResize() {
    this.updateStyle();
  };

  _proto.updateStyle = function updateStyle() {
    if (!_inDOM.default) {
      return;
    }

    var dialogNode = this._modal.getDialogElement();

    var dialogHeight = dialogNode.scrollHeight;
    var document = (0, _ownerDocument.default)(dialogNode);
    var bodyIsOverflowing = (0, _isOverflowing.default)(_reactDom.default.findDOMNode(this.props.container || document.body));
    var modalIsOverflowing = dialogHeight > document.documentElement.clientHeight;
    this.setState({
      style: {
        paddingRight: bodyIsOverflowing && !modalIsOverflowing ? (0, _scrollbarSize.default)() : undefined,
        paddingLeft: !bodyIsOverflowing && modalIsOverflowing ? (0, _scrollbarSize.default)() : undefined
      }
    });
  };

  _proto.render = function render() {
    var _this$props = this.props,
        backdrop = _this$props.backdrop,
        backdropClassName = _this$props.backdropClassName,
        animation = _this$props.animation,
        show = _this$props.show,
        Dialog = _this$props.dialogComponentClass,
        className = _this$props.className,
        style = _this$props.style,
        children = _this$props.children,
        onEntering = _this$props.onEntering,
        onExited = _this$props.onExited,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["backdrop", "backdropClassName", "animation", "show", "dialogComponentClass", "className", "style", "children", "onEntering", "onExited"]);

    var _splitComponentProps = (0, _splitComponentProps2.default)(props, _Modal.default),
        baseModalProps = _splitComponentProps[0],
        dialogProps = _splitComponentProps[1];

    var inClassName = show && !animation && 'in';
    return _react.default.createElement(_Modal.default, (0, _extends2.default)({}, baseModalProps, {
      ref: this.setModalRef,
      show: show,
      containerClassName: (0, _bootstrapUtils.prefix)(props, 'open'),
      transition: animation ? DialogTransition : undefined,
      backdrop: backdrop,
      backdropTransition: animation ? BackdropTransition : undefined,
      backdropClassName: (0, _classnames.default)((0, _bootstrapUtils.prefix)(props, 'backdrop'), backdropClassName, inClassName),
      onEntering: (0, _createChainedFunction.default)(onEntering, this.handleEntering),
      onExited: (0, _createChainedFunction.default)(onExited, this.handleExited),
      onMouseUp: this.handleMouseUp
    }), _react.default.createElement(Dialog, (0, _extends2.default)({}, dialogProps, {
      style: (0, _extends2.default)({}, this.state.style, style),
      className: (0, _classnames.default)(className, inClassName),
      onClick: backdrop === true ? this.handleDialogClick : null,
      onMouseDownDialog: this.handleDialogBackdropMouseDown
    }), children));
  };

  return Modal;
}(_react.default.Component);

Modal.propTypes = propTypes;
Modal.defaultProps = defaultProps;
Modal.childContextTypes = childContextTypes;
Modal.Body = _ModalBody.default;
Modal.Header = _ModalHeader.default;
Modal.Title = _ModalTitle.default;
Modal.Footer = _ModalFooter.default;
Modal.Dialog = _ModalDialog.default;
Modal.TRANSITION_DURATION = 300;
Modal.BACKDROP_TRANSITION_DURATION = 150;

var _default = (0, _bootstrapUtils.bsClass)('modal', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.LARGE, _StyleConfig.Size.SMALL], Modal));

exports.default = _default;
module.exports = exports["default"];