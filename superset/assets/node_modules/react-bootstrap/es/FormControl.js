import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';
import warning from 'warning';

import FormControlFeedback from './FormControlFeedback';
import FormControlStatic from './FormControlStatic';
import { prefix, bsClass, getClassSet, splitBsProps, bsSizes } from './utils/bootstrapUtils';
import { SIZE_MAP, Size } from './utils/StyleConfig';

var propTypes = {
  componentClass: elementType,
  /**
   * Only relevant if `componentClass` is `'input'`.
   */
  type: PropTypes.string,
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  id: PropTypes.string,
  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <FormControl inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: PropTypes.func
};

var defaultProps = {
  componentClass: 'input'
};

var contextTypes = {
  $bs_formGroup: PropTypes.object
};

var FormControl = function (_React$Component) {
  _inherits(FormControl, _React$Component);

  function FormControl() {
    _classCallCheck(this, FormControl);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  FormControl.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props,
        Component = _props.componentClass,
        type = _props.type,
        _props$id = _props.id,
        id = _props$id === undefined ? controlId : _props$id,
        inputRef = _props.inputRef,
        className = _props.className,
        bsSize = _props.bsSize,
        props = _objectWithoutProperties(_props, ['componentClass', 'type', 'id', 'inputRef', 'className', 'bsSize']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== 'production' ? warning(controlId == null || id === controlId, '`controlId` is ignored on `<FormControl>` when `id` is specified.') : void 0;

    // input[type="file"] should not have .form-control.
    var classes = void 0;
    if (type !== 'file') {
      classes = getClassSet(bsProps);
    }

    // If user provides a size, make sure to append it to classes as input-
    // e.g. if bsSize is small, it will append input-sm
    if (bsSize) {
      var size = SIZE_MAP[bsSize] || bsSize;
      classes[prefix({ bsClass: 'input' }, size)] = true;
    }

    return React.createElement(Component, _extends({}, elementProps, {
      type: type,
      id: id,
      ref: inputRef,
      className: classNames(className, classes)
    }));
  };

  return FormControl;
}(React.Component);

FormControl.propTypes = propTypes;
FormControl.defaultProps = defaultProps;
FormControl.contextTypes = contextTypes;

FormControl.Feedback = FormControlFeedback;
FormControl.Static = FormControlStatic;

export default bsClass('form-control', bsSizes([Size.SMALL, Size.LARGE], FormControl));