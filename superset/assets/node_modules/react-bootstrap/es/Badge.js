import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

// TODO: `pullRight` doesn't belong here. There's no special handling here.

var propTypes = {
  pullRight: PropTypes.bool
};

var defaultProps = {
  pullRight: false
};

var Badge = function (_React$Component) {
  _inherits(Badge, _React$Component);

  function Badge() {
    _classCallCheck(this, Badge);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Badge.prototype.hasContent = function hasContent(children) {
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

  Badge.prototype.render = function render() {
    var _props = this.props,
        pullRight = _props.pullRight,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['pullRight', 'className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), {
      'pull-right': pullRight,

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

  return Badge;
}(React.Component);

Badge.propTypes = propTypes;
Badge.defaultProps = defaultProps;

export default bsClass('badge', Badge);