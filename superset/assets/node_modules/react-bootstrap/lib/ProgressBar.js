'use strict';

exports.__esModule = true;

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

  _react2.default.Children.forEach(children, function (child) {
    if (error) {
      return;
    }

    if (child.type === ProgressBar) {
      // eslint-disable-line no-use-before-define
      return;
    }

    var childIdentifier = _react2.default.isValidElement(child) ? child.type.displayName || child.type.name || child.type : child;
    error = new Error('Children of ' + componentName + ' can contain only ProgressBar ' + ('components. Found ' + childIdentifier + '.'));
  });

  return error;
}

var propTypes = {
  min: _propTypes2.default.number,
  now: _propTypes2.default.number,
  max: _propTypes2.default.number,
  label: _propTypes2.default.node,
  srOnly: _propTypes2.default.bool,
  striped: _propTypes2.default.bool,
  active: _propTypes2.default.bool,
  children: onlyProgressBar,

  /**
   * @private
   */
  isChild: _propTypes2.default.bool
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
  (0, _inherits3.default)(ProgressBar, _React$Component);

  function ProgressBar() {
    (0, _classCallCheck3.default)(this, ProgressBar);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
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
        props = (0, _objectWithoutProperties3.default)(_ref, ['min', 'now', 'max', 'label', 'srOnly', 'striped', 'active', 'className', 'style']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {
      active: active
    }, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'striped')] = active || striped, _extends2));

    return _react2.default.createElement(
      'div',
      (0, _extends4.default)({}, elementProps, {
        role: 'progressbar',
        className: (0, _classnames2.default)(className, classes),
        style: (0, _extends4.default)({ width: getPercentage(now, min, max) + '%' }, style),
        'aria-valuenow': now,
        'aria-valuemin': min,
        'aria-valuemax': max
      }),
      srOnly ? _react2.default.createElement(
        'span',
        { className: 'sr-only' },
        label
      ) : label
    );
  };

  ProgressBar.prototype.render = function render() {
    var _props = this.props,
        isChild = _props.isChild,
        props = (0, _objectWithoutProperties3.default)(_props, ['isChild']);


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
        wrapperProps = (0, _objectWithoutProperties3.default)(props, ['min', 'now', 'max', 'label', 'srOnly', 'striped', 'active', 'bsClass', 'bsStyle', 'className', 'children']);


    return _react2.default.createElement(
      'div',
      (0, _extends4.default)({}, wrapperProps, {
        className: (0, _classnames2.default)(className, 'progress')
      }),
      children ? _ValidComponentChildren2.default.map(children, function (child) {
        return (0, _react.cloneElement)(child, { isChild: true });
      }) : this.renderProgressBar({
        min: min, now: now, max: max, label: label, srOnly: srOnly, striped: striped, active: active, bsClass: bsClass, bsStyle: bsStyle
      })
    );
  };

  return ProgressBar;
}(_react2.default.Component);

ProgressBar.propTypes = propTypes;
ProgressBar.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('progress-bar', (0, _bootstrapUtils.bsStyles)((0, _values2.default)(_StyleConfig.State), ProgressBar));
module.exports = exports['default'];