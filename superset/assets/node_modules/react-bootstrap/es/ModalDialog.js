import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, bsSizes, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';

var propTypes = {
  /**
   * A css class to apply to the Modal dialog DOM node.
   */
  dialogClassName: PropTypes.string
};

var ModalDialog = function (_React$Component) {
  _inherits(ModalDialog, _React$Component);

  function ModalDialog() {
    _classCallCheck(this, ModalDialog);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ModalDialog.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        dialogClassName = _props.dialogClassName,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['dialogClassName', 'className', 'style', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var bsClassName = prefix(bsProps);

    var modalStyle = _extends({ display: 'block' }, style);

    var dialogClasses = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[bsClassName] = false, _extends2[prefix(bsProps, 'dialog')] = true, _extends2));

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        tabIndex: '-1',
        role: 'dialog',
        style: modalStyle,
        className: classNames(className, bsClassName)
      }),
      React.createElement(
        'div',
        { className: classNames(dialogClassName, dialogClasses) },
        React.createElement(
          'div',
          { className: prefix(bsProps, 'content'), role: 'document' },
          children
        )
      )
    );
  };

  return ModalDialog;
}(React.Component);

ModalDialog.propTypes = propTypes;

export default bsClass('modal', bsSizes([Size.LARGE, Size.SMALL], ModalDialog));