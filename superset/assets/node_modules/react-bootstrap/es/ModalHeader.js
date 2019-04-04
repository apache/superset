import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import CloseButton from './CloseButton';

// TODO: `aria-label` should be `closeLabel`.

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

var ModalHeader = function (_React$Component) {
  _inherits(ModalHeader, _React$Component);

  function ModalHeader() {
    _classCallCheck(this, ModalHeader);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ModalHeader.prototype.render = function render() {
    var _props = this.props,
        closeLabel = _props.closeLabel,
        closeButton = _props.closeButton,
        onHide = _props.onHide,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['closeLabel', 'closeButton', 'onHide', 'className', 'children']);

    var modal = this.context.$bs_modal;

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      closeButton && React.createElement(CloseButton, {
        label: closeLabel,
        onClick: createChainedFunction(modal && modal.onHide, onHide)
      }),
      children
    );
  };

  return ModalHeader;
}(React.Component);

ModalHeader.propTypes = propTypes;
ModalHeader.defaultProps = defaultProps;
ModalHeader.contextTypes = contextTypes;

export default bsClass('modal-header', ModalHeader);