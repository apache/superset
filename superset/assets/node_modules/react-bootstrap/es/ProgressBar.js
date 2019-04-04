import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';
import PropTypes from 'prop-types';

import { bsClass as setBsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { State } from './utils/StyleConfig';
import ValidComponentChildren from './utils/ValidComponentChildren';

var ROUND_PRECISION = 1000;

/**
 * Validate that children, if any, are instances of `<ProgressBar>`.
 */
function onlyProgressBar(props, propName, componentName) {
  var children = props[propName];
  if (!children) {
    return null;
  }

  var error = null;

  React.Children.forEach(children, function (child) {
    if (error) {
      return;
    }

    if (child.type === ProgressBar) {
      // eslint-disable-line no-use-before-define
      return;
    }

    var childIdentifier = React.isValidElement(child) ? child.type.displayName || child.type.name || child.type : child;
    error = new Error('Children of ' + componentName + ' can contain only ProgressBar ' + ('components. Found ' + childIdentifier + '.'));
  });

  return error;
}

var propTypes = {
  min: PropTypes.number,
  now: PropTypes.number,
  max: PropTypes.number,
  label: PropTypes.node,
  srOnly: PropTypes.bool,
  striped: PropTypes.bool,
  active: PropTypes.bool,
  children: onlyProgressBar,

  /**
   * @private
   */
  isChild: PropTypes.bool
};

var defaultProps = {
  min: 0,
  max: 100,
  active: false,
  isChild: false,
  srOnly: false,
  striped: false
};

function getPercentage(now, min, max) {
  var percentage = (now - min) / (max - min) * 100;
  return Math.round(percentage * ROUND_PRECISION) / ROUND_PRECISION;
}

var ProgressBar = function (_React$Component) {
  _inherits(ProgressBar, _React$Component);

  function ProgressBar() {
    _classCallCheck(this, ProgressBar);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ProgressBar.prototype.renderProgressBar = function renderProgressBar(_ref) {
    var _extends2;

    var min = _ref.min,
        now = _ref.now,
        max = _ref.max,
        label = _ref.label,
        srOnly = _ref.srOnly,
        striped = _ref.striped,
        active = _ref.active,
        className = _ref.className,
        style = _ref.style,
        props = _objectWithoutProperties(_ref, ['min', 'now', 'max', 'label', 'srOnly', 'striped', 'active', 'className', 'style']);

    var _splitBsProps = splitBsProps(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {
      active: active
    }, _extends2[prefix(bsProps, 'striped')] = active || striped, _extends2));

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        role: 'progressbar',
        className: classNames(className, classes),
        style: _extends({ width: getPercentage(now, min, max) + '%' }, style),
        'aria-valuenow': now,
        'aria-valuemin': min,
        'aria-valuemax': max
      }),
      srOnly ? React.createElement(
        'span',
        { className: 'sr-only' },
        label
      ) : label
    );
  };

  ProgressBar.prototype.render = function render() {
    var _props = this.props,
        isChild = _props.isChild,
        props = _objectWithoutProperties(_props, ['isChild']);

    if (isChild) {
      return this.renderProgressBar(props);
    }

    var min = props.min,
        now = props.now,
        max = props.max,
        label = props.label,
        srOnly = props.srOnly,
        striped = props.striped,
        active = props.active,
        bsClass = props.bsClass,
        bsStyle = props.bsStyle,
        className = props.className,
        children = props.children,
        wrapperProps = _objectWithoutProperties(props, ['min', 'now', 'max', 'label', 'srOnly', 'striped', 'active', 'bsClass', 'bsStyle', 'className', 'children']);

    return React.createElement(
      'div',
      _extends({}, wrapperProps, {
        className: classNames(className, 'progress')
      }),
      children ? ValidComponentChildren.map(children, function (child) {
        return cloneElement(child, { isChild: true });
      }) : this.renderProgressBar({
        min: min, now: now, max: max, label: label, srOnly: srOnly, striped: striped, active: active, bsClass: bsClass, bsStyle: bsStyle
      })
    );
  };

  return ProgressBar;
}(React.Component);

ProgressBar.propTypes = propTypes;
ProgressBar.defaultProps = defaultProps;

export default setBsClass('progress-bar', bsStyles(_Object$values(State), ProgressBar));