import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { State } from './utils/StyleConfig';
import CloseButton from './CloseButton';

var propTypes = {
  onDismiss: PropTypes.func,
  closeLabel: PropTypes.string
};

var defaultProps = {
  closeLabel: 'Close alert'
};

var Alert = function (_React$Component) {
  _inherits(Alert, _React$Component);

  function Alert() {
    _classCallCheck(this, Alert);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Alert.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        onDismiss = _props.onDismiss,
        closeLabel = _props.closeLabel,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['onDismiss', 'closeLabel', 'className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var dismissable = !!onDismiss;
    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'dismissable')] = dismissable, _extends2));

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        role: 'alert',
        className: classNames(className, classes)
      }),
      dismissable && React.createElement(CloseButton, {
        onClick: onDismiss,
        label: closeLabel
      }),
      children
    );
  };

  return Alert;
}(React.Component);

Alert.propTypes = propTypes;
Alert.defaultProps = defaultProps;

export default bsStyles(_Object$values(State), State.INFO, bsClass('alert', Alert));