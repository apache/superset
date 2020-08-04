import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import _assertThisInitialized from "@babel/runtime-corejs2/helpers/esm/assertThisInitialized";
import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import classNames from 'classnames';
import events from 'dom-helpers/events';
import ownerDocument from 'dom-helpers/ownerDocument';
import canUseDOM from 'dom-helpers/util/inDOM';
import getScrollbarSize from 'dom-helpers/util/scrollbarSize';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import BaseModal from 'react-overlays/lib/Modal';
import isOverflowing from 'react-overlays/lib/utils/isOverflowing';
import elementType from 'prop-types-extra/lib/elementType';
import Fade from './Fade';
import Body from './ModalBody';
import ModalDialog from './ModalDialog';
import Footer from './ModalFooter';
import Header from './ModalHeader';
import Title from './ModalTitle';
import { bsClass, bsSizes, prefix } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import splitComponentProps from './utils/splitComponentProps';
import { Size } from './utils/StyleConfig';

var propTypes = _extends({}, BaseModal.propTypes, ModalDialog.propTypes, {
  /**
   * Include a backdrop component. Specify 'static' for a backdrop that doesn't
   * trigger an "onHide" when clicked.
   */
  backdrop: PropTypes.oneOf(['static', true, false]),

  /**
   * Add an optional extra class name to .modal-backdrop
   * It could end up looking like class="modal-backdrop foo-modal-backdrop in".
   */
  backdropClassName: PropTypes.string,

  /**
   * Close the modal when escape key is pressed
   */
  keyboard: PropTypes.bool,

  /**
   * Open and close the Modal with a slide and fade animation.
   */
  animation: PropTypes.bool,

  /**
   * A Component type that provides the modal content Markup. This is a useful
   * prop when you want to use your own styles and markup to create a custom
   * modal component.
   */
  dialogComponentClass: elementType,

  /**
   * When `true` The modal will automatically shift focus to itself when it
   * opens, and replace it to the last focused element when it closes.
   * Generally this should never be set to false as it makes the Modal less
   * accessible to assistive technologies, like screen-readers.
   */
  autoFocus: PropTypes.bool,

  /**
   * When `true` The modal will prevent focus from leaving the Modal while
   * open. Consider leaving the default value here, as it is necessary to make
   * the Modal work well with assistive technologies, such as screen readers.
   */
  enforceFocus: PropTypes.bool,

  /**
   * When `true` The modal will restore focus to previously focused element once
   * modal is hidden
   */
  restoreFocus: PropTypes.bool,

  /**
   * When `true` The modal will show itself.
   */
  show: PropTypes.bool,

  /**
   * A callback fired when the header closeButton or non-static backdrop is
   * clicked. Required if either are specified.
   */
  onHide: PropTypes.func,

  /**
   * Callback fired before the Modal transitions in
   */
  onEnter: PropTypes.func,

  /**
   * Callback fired as the Modal begins to transition in
   */
  onEntering: PropTypes.func,

  /**
   * Callback fired after the Modal finishes transitioning in
   */
  onEntered: PropTypes.func,

  /**
   * Callback fired right before the Modal transitions out
   */
  onExit: PropTypes.func,

  /**
   * Callback fired as the Modal begins to transition out
   */
  onExiting: PropTypes.func,

  /**
   * Callback fired after the Modal finishes transitioning out
   */
  onExited: PropTypes.func,

  /**
   * @private
   */
  container: BaseModal.propTypes.container
});

var defaultProps = _extends({}, BaseModal.defaultProps, {
  animation: true,
  dialogComponentClass: ModalDialog
});

var childContextTypes = {
  $bs_modal: PropTypes.shape({
    onHide: PropTypes.func
  })
};
/* eslint-disable no-use-before-define, react/no-multi-comp */

function DialogTransition(props) {
  return React.createElement(Fade, _extends({}, props, {
    timeout: Modal.TRANSITION_DURATION
  }));
}

function BackdropTransition(props) {
  return React.createElement(Fade, _extends({}, props, {
    timeout: Modal.BACKDROP_TRANSITION_DURATION
  }));
}
/* eslint-enable no-use-before-define */


var Modal =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(Modal, _React$Component);

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

    _this.handleEntering = _this.handleEntering.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleExited = _this.handleExited.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleWindowResize = _this.handleWindowResize.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.handleDialogClick = _this.handleDialogClick.bind(_assertThisInitialized(_assertThisInitialized(_this)));
    _this.setModalRef = _this.setModalRef.bind(_assertThisInitialized(_assertThisInitialized(_this)));
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
    events.on(window, 'resize', this.handleWindowResize);
    this.updateStyle();
  };

  _proto.handleExited = function handleExited() {
    // FIXME: This should work even when animation is disabled.
    events.off(window, 'resize', this.handleWindowResize);
  };

  _proto.handleWindowResize = function handleWindowResize() {
    this.updateStyle();
  };

  _proto.updateStyle = function updateStyle() {
    if (!canUseDOM) {
      return;
    }

    var dialogNode = this._modal.getDialogElement();

    var dialogHeight = dialogNode.scrollHeight;
    var document = ownerDocument(dialogNode);
    var bodyIsOverflowing = isOverflowing(ReactDOM.findDOMNode(this.props.container || document.body));
    var modalIsOverflowing = dialogHeight > document.documentElement.clientHeight;
    this.setState({
      style: {
        paddingRight: bodyIsOverflowing && !modalIsOverflowing ? getScrollbarSize() : undefined,
        paddingLeft: !bodyIsOverflowing && modalIsOverflowing ? getScrollbarSize() : undefined
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
        props = _objectWithoutPropertiesLoose(_this$props, ["backdrop", "backdropClassName", "animation", "show", "dialogComponentClass", "className", "style", "children", "onEntering", "onExited"]);

    var _splitComponentProps = splitComponentProps(props, BaseModal),
        baseModalProps = _splitComponentProps[0],
        dialogProps = _splitComponentProps[1];

    var inClassName = show && !animation && 'in';
    return React.createElement(BaseModal, _extends({}, baseModalProps, {
      ref: this.setModalRef,
      show: show,
      containerClassName: prefix(props, 'open'),
      transition: animation ? DialogTransition : undefined,
      backdrop: backdrop,
      backdropTransition: animation ? BackdropTransition : undefined,
      backdropClassName: classNames(prefix(props, 'backdrop'), backdropClassName, inClassName),
      onEntering: createChainedFunction(onEntering, this.handleEntering),
      onExited: createChainedFunction(onExited, this.handleExited),
      onMouseUp: this.handleMouseUp
    }), React.createElement(Dialog, _extends({}, dialogProps, {
      style: _extends({}, this.state.style, style),
      className: classNames(className, inClassName),
      onClick: backdrop === true ? this.handleDialogClick : null,
      onMouseDownDialog: this.handleDialogBackdropMouseDown
    }), children));
  };

  return Modal;
}(React.Component);

Modal.propTypes = propTypes;
Modal.defaultProps = defaultProps;
Modal.childContextTypes = childContextTypes;
Modal.Body = Body;
Modal.Header = Header;
Modal.Title = Title;
Modal.Footer = Footer;
Modal.Dialog = ModalDialog;
Modal.TRANSITION_DURATION = 300;
Modal.BACKDROP_TRANSITION_DURATION = 150;
export default bsClass('modal', bsSizes([Size.LARGE, Size.SMALL], Modal));