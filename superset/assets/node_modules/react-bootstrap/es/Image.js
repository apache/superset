import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import { bsClass, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Sets image as responsive image
   */
  responsive: PropTypes.bool,

  /**
   * Sets image shape as rounded
   */
  rounded: PropTypes.bool,

  /**
   * Sets image shape as circle
   */
  circle: PropTypes.bool,

  /**
   * Sets image shape as thumbnail
   */
  thumbnail: PropTypes.bool
};

var defaultProps = {
  responsive: false,
  rounded: false,
  circle: false,
  thumbnail: false
};

var Image = function (_React$Component) {
  _inherits(Image, _React$Component);

  function Image() {
    _classCallCheck(this, Image);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Image.prototype.render = function render() {
    var _classes;

    var _props = this.props,
        responsive = _props.responsive,
        rounded = _props.rounded,
        circle = _props.circle,
        thumbnail = _props.thumbnail,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['responsive', 'rounded', 'circle', 'thumbnail', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (_classes = {}, _classes[prefix(bsProps, 'responsive')] = responsive, _classes[prefix(bsProps, 'rounded')] = rounded, _classes[prefix(bsProps, 'circle')] = circle, _classes[prefix(bsProps, 'thumbnail')] = thumbnail, _classes);

    return React.createElement('img', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Image;
}(React.Component);

Image.propTypes = propTypes;
Image.defaultProps = defaultProps;

export default bsClass('img', Image);