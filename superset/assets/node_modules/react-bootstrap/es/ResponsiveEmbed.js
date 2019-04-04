import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';
import warning from 'warning';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

// TODO: This should probably take a single `aspectRatio` prop.

var propTypes = {
  /**
   * This component requires a single child element
   */
  children: PropTypes.element.isRequired,
  /**
   * 16by9 aspect ratio
   */
  a16by9: PropTypes.bool,
  /**
   * 4by3 aspect ratio
   */
  a4by3: PropTypes.bool
};

var defaultProps = {
  a16by9: false,
  a4by3: false
};

var ResponsiveEmbed = function (_React$Component) {
  _inherits(ResponsiveEmbed, _React$Component);

  function ResponsiveEmbed() {
    _classCallCheck(this, ResponsiveEmbed);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ResponsiveEmbed.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        a16by9 = _props.a16by9,
        a4by3 = _props.a4by3,
        className = _props.className,
        children = _props.children,
        props = _objectWithoutProperties(_props, ['a16by9', 'a4by3', 'className', 'children']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== 'production' ? warning(a16by9 || a4by3, 'Either `a16by9` or `a4by3` must be set.') : void 0;
    process.env.NODE_ENV !== 'production' ? warning(!(a16by9 && a4by3), 'Only one of `a16by9` or `a4by3` can be set.') : void 0;

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, '16by9')] = a16by9, _extends2[prefix(bsProps, '4by3')] = a4by3, _extends2));

    return React.createElement(
      'div',
      { className: classNames(classes) },
      cloneElement(children, _extends({}, elementProps, {
        className: classNames(className, prefix(bsProps, 'item'))
      }))
    );
  };

  return ResponsiveEmbed;
}(React.Component);

ResponsiveEmbed.propTypes = propTypes;
ResponsiveEmbed.defaultProps = defaultProps;

export default bsClass('embed-responsive', ResponsiveEmbed);