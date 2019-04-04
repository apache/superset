import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import PropTypes from 'prop-types';
import elementType from 'prop-types-extra/lib/elementType';

import Media from './Media';
import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Align the media to the top, middle, or bottom of the media object.
   */
  align: PropTypes.oneOf(['top', 'middle', 'bottom']),

  componentClass: elementType
};

var defaultProps = {
  componentClass: 'div'
};

var MediaBody = function (_React$Component) {
  _inherits(MediaBody, _React$Component);

  function MediaBody() {
    _classCallCheck(this, MediaBody);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  MediaBody.prototype.render = function render() {
    var _props = this.props,
        Component = _props.componentClass,
        align = _props.align,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['componentClass', 'align', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    if (align) {
      // The class is e.g. `media-top`, not `media-left-top`.
      classes[prefix(Media.defaultProps, align)] = true;
    }

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return MediaBody;
}(React.Component);

MediaBody.propTypes = propTypes;
MediaBody.defaultProps = defaultProps;

export default bsClass('media-body', MediaBody);