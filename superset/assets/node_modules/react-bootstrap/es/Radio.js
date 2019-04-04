import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
/* eslint-disable jsx-a11y/label-has-for */

import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  inline: PropTypes.bool,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  /**
   * Only valid if `inline` is not set.
   */
  validationState: PropTypes.oneOf(['success', 'warning', 'error', null]),
  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <Radio inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: PropTypes.func
};

var defaultProps = {
  inline: false,
  disabled: false,
  title: ''
};

var Radio = function (_React$Component) {
  _inherits(Radio, _React$Component);

  function Radio() {
    _classCallCheck(this, Radio);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Radio.prototype.render = function render() {
    var _props = this.props,
        inline = _props.inline,
        disabled = _props.disabled,
        validationState = _props.validationState,
        inputRef = _props.inputRef,
        className = _props.className,
        style = _props.style,
        title = _props.title,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['inline', 'disabled', 'validationState', 'inputRef', 'className', 'style', 'title', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var input = React.createElement('input', _extends({}, elementProps, {
      ref: inputRef,
      type: 'radio',
      disabled: disabled
    }));

    if (inline) {
      var _classes2;

      var _classes = (_classes2 = {}, _classes2[prefix(bsProps, 'inline')] = true, _classes2.disabled = disabled, _classes2);

      // Use a warning here instead of in propTypes to get better-looking
      // generated documentation.
      process.env.NODE_ENV !== 'production' ? warning(!validationState, '`validationState` is ignored on `<Radio inline>`. To display ' + 'validation state on an inline radio, set `validationState` on a ' + 'parent `<FormGroup>` or other element instead.') : void 0;

      return React.createElement(
        'label',
        { className: classNames(className, _classes), style: style, title: title },
        input,
        children
      );
    }

    var classes = _extends({}, getClassSet(bsProps), {
      disabled: disabled
    });
    if (validationState) {
      classes['has-' + validationState] = true;
    }

    return React.createElement(
      'div',
      { className: classNames(className, classes), style: style },
      React.createElement(
        'label',
        { title: title },
        input,
        children
      )
    );
  };

  return Radio;
}(React.Component);

Radio.propTypes = propTypes;
Radio.defaultProps = defaultProps;

export default bsClass('radio', Radio);