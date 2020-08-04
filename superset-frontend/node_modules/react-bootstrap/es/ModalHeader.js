import _extends from "@babel/runtime-corejs2/helpers/esm/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose";
import _inheritsLoose from "@babel/runtime-corejs2/helpers/esm/inheritsLoose";
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import CloseButton from './CloseButton'; // TODO: `aria-label` should be `closeLabel`.

var propTypes = {
  /**
   * Provides an accessible label for the close
   * button. It is used for Assistive Technology when the label text is not
   * readable.
   */
  closeLabel: PropTypes.string,

  /**
   * Specify whether the Component should contain a close button
   */
  closeButton: PropTypes.bool,

  /**
   * A Callback fired when the close button is clicked. If used directly inside
   * a Modal component, the onHide will automatically be propagated up to the
   * parent Modal `onHide`.
   */
  onHide: PropTypes.func
};
var defaultProps = {
  closeLabel: 'Close',
  closeButton: false
};
var contextTypes = {
  $bs_modal: PropTypes.shape({
    onHide: PropTypes.func
  })
};

var ModalHeader =
/*#__PURE__*/
function (_React$Component) {
  _inheritsLoose(ModalHeader, _React$Component);

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
        props = _objectWithoutPropertiesLoose(_this$props, ["closeLabel", "closeButton", "onHide", "className", "children"]);

    var modal = this.context.$bs_modal;

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);
    return React.createElement("div", _extends({}, elementProps, {
      className: classNames(className, classes)
    }), closeButton && React.createElement(CloseButton, {
      label: closeLabel,
      onClick: createChainedFunction(modal && modal.onHide, onHide)
    }), children);
  };

  return ModalHeader;
}(React.Component);

ModalHeader.propTypes = propTypes;
ModalHeader.defaultProps = defaultProps;
ModalHeader.contextTypes = contextTypes;
export default bsClass('modal-header', ModalHeader);