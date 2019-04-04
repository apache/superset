import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import Glyphicon from './Glyphicon';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var defaultProps = {
  bsRole: 'feedback'
};

var contextTypes = {
  $bs_formGroup: PropTypes.object
};

var FormControlFeedback = function (_React$Component) {
  _inherits(FormControlFeedback, _React$Component);

  function FormControlFeedback() {
    _classCallCheck(this, FormControlFeedback);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
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

    return React.createElement(Glyphicon, _extends({}, elementProps, {
      glyph: glyph,
      className: classNames(className, classes)
    }));
  };

  FormControlFeedback.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    if (!children) {
      return this.renderDefaultFeedback(this.context.$bs_formGroup, className, classes, elementProps);
    }

    var child = React.Children.only(children);
    return React.cloneElement(child, _extends({}, elementProps, {
      className: classNames(child.props.className, className, classes)
    }));
  };

  return FormControlFeedback;
}(React.Component);

FormControlFeedback.defaultProps = defaultProps;
FormControlFeedback.contextTypes = contextTypes;

export default bsClass('form-control-feedback', FormControlFeedback);