import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import elementType from 'prop-types-extra/lib/elementType';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  componentClass: elementType
};

var defaultProps = {
  componentClass: 'h4'
};

var MediaHeading = function (_React$Component) {
  _inherits(MediaHeading, _React$Component);

  function MediaHeading() {
    _classCallCheck(this, MediaHeading);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  MediaHeading.prototype.render = function render() {
    var _props = this.props,
        Component = _props.componentClass,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['componentClass', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = getClassSet(bsProps);

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return MediaHeading;
}(React.Component);

MediaHeading.propTypes = propTypes;
MediaHeading.defaultProps = defaultProps;

export default bsClass('media-heading', MediaHeading);