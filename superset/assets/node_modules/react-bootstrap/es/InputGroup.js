import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import InputGroupAddon from './InputGroupAddon';
import InputGroupButton from './InputGroupButton';
import { bsClass, bsSizes, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';

var InputGroup = function (_React$Component) {
  _inherits(InputGroup, _React$Component);

  function InputGroup() {
    _classCallCheck(this, InputGroup);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  InputGroup.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement('span', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return InputGroup;
}(React.Component);

InputGroup.Addon = InputGroupAddon;
InputGroup.Button = InputGroupButton;

export default bsClass('input-group', bsSizes([Size.LARGE, Size.SMALL], InputGroup));