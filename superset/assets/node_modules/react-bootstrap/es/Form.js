import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';

import { bsClass, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  horizontal: PropTypes.bool,
  inline: PropTypes.bool,
  componentClass: elementType
};

var defaultProps = {
  horizontal: false,
  inline: false,
  componentClass: 'form'
};

var Form = function (_React$Component) {
  _inherits(Form, _React$Component);

  function Form() {
    _classCallCheck(this, Form);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Form.prototype.render = function render() {
    var _props = this.props,
        horizontal = _props.horizontal,
        inline = _props.inline,
        Component = _props.componentClass,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['horizontal', 'inline', 'componentClass', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = [];
    if (horizontal) {
      classes.push(prefix(bsProps, 'horizontal'));
    }
    if (inline) {
      classes.push(prefix(bsProps, 'inline'));
    }

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Form;
}(React.Component);

Form.propTypes = propTypes;
Form.defaultProps = defaultProps;

export default bsClass('form', Form);