import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';

import Media from './Media';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Align the media to the top, middle, or bottom of the media object.
   */
  align: PropTypes.oneOf(['top', 'middle', 'bottom'])
};

var MediaLeft = function (_React$Component) {
  _inherits(MediaLeft, _React$Component);

  function MediaLeft() {
    _classCallCheck(this, MediaLeft);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  MediaLeft.prototype.render = function render() {
    var _props = this.props,
        align = _props.align,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['align', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    if (align) {
      // The class is e.g. `media-top`, not `media-left-top`.
      classes[prefix(Media.defaultProps, align)] = true;
    }

    return React.createElement('div', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return MediaLeft;
}(React.Component);

MediaLeft.propTypes = propTypes;

export default bsClass('media-left', MediaLeft);