import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, bsSizes, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  /**
   * Sets `id` on `<FormControl>` and `htmlFor` on `<FormGroup.Label>`.
   */
  controlId: PropTypes.string,
  validationState: PropTypes.oneOf(['success', 'warning', 'error', null])
};

var childContextTypes = {
  $bs_formGroup: PropTypes.object.isRequired
};

var FormGroup = function (_React$Component) {
  _inherits(FormGroup, _React$Component);

  function FormGroup() {
    _classCallCheck(this, FormGroup);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  FormGroup.prototype.getChildContext = function getChildContext() {
    var _props = this.props,
        controlId = _props.controlId,
        validationState = _props.validationState;


    return {
      $bs_formGroup: {
        controlId: controlId,
        validationState: validationState
      }
    };
  };

  FormGroup.prototype.hasFeedback = function hasFeedback(children) {
    var _this2 = this;

    return ValidComponentChildren.some(children, function (child) {
      return child.props.bsRole === 'feedback' || child.props.children && _this2.hasFeedback(child.props.children);
    });
  };

  FormGroup.prototype.render = function render() {
    var _props2 = this.props,
        validationState = _props2.validationState,
        className = _props2.className,
        children = _props2.children,
        props = _objectWithoutProperties(_props2, ['validationState', 'className', 'children']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['controlId']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    var classes = _extends({}, getClassSet(bsProps), {
      'has-feedback': this.hasFeedback(children)
    });
    if (validationState) {
      classes['has-' + validationState] = true;
    }

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      children
    );
  };

  return FormGroup;
}(React.Component);

FormGroup.propTypes = propTypes;
FormGroup.childContextTypes = childContextTypes;

export default bsClass('form-group', bsSizes([Size.LARGE, Size.SMALL], FormGroup));