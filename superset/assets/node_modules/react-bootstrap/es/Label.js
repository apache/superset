import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, bsStyles, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import { State, Style } from './utils/StyleConfig';

var Label = function (_React$Component) {
  _inherits(Label, _React$Component);

  function Label() {
    _classCallCheck(this, Label);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Label.prototype.hasContent = function hasContent(children) {
    var result = false;

    React.Children.forEach(children, function (child) {
      if (result) {
        return;
      }

      if (child || child === 0) {
        result = true;
      }
    });

    return result;
  };

  Label.prototype.render = function render() {
    var _props = this.props,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), {

      // Hack for collapsing on IE8.
      hidden: !this.hasContent(children)
    });

    return React.createElement(
      'span',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      children
    );
  };

  return Label;
}(React.Component);

export default bsClass('label', bsStyles([].concat(_Object$values(State), [Style.DEFAULT, Style.PRIMARY]), Style.DEFAULT, Label));