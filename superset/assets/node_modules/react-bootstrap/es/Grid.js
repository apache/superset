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
  /**
   * Turn any fixed-width grid layout into a full-width layout by this property.
   *
   * Adds `container-fluid` class.
   */
  fluid: PropTypes.bool,
  /**
   * You can use a custom element for this component
   */
  componentClass: elementType
};

var defaultProps = {
  componentClass: 'div',
  fluid: false
};

var Grid = function (_React$Component) {
  _inherits(Grid, _React$Component);

  function Grid() {
    _classCallCheck(this, Grid);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Grid.prototype.render = function render() {
    var _props = this.props,
        fluid = _props.fluid,
        Component = _props.componentClass,
        className = _props.className,
        props = _objectWithoutProperties(_props, ['fluid', 'componentClass', 'className']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = prefix(bsProps, fluid && 'fluid');

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Grid;
}(React.Component);

Grid.propTypes = propTypes;
Grid.defaultProps = defaultProps;

export default bsClass('container', Grid);