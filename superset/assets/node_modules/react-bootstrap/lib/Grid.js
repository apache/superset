'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * Turn any fixed-width grid layout into a full-width layout by this property.
   *
   * Adds `container-fluid` class.
   */
  fluid: _propTypes2.default.bool,
  /**
   * You can use a custom element for this component
   */
  componentClass: _elementType2.default
};

var defaultProps = {
  componentClass: 'div',
  fluid: false
};

var Grid = function (_React$Component) {
  (0, _inherits3.default)(Grid, _React$Component);

  function Grid() {
    (0, _classCallCheck3.default)(this, Grid);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Grid.prototype.render = function render() {
    var _props = this.props,
        fluid = _props.fluid,
        Component = _props.componentClass,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['fluid', 'componentClass', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.prefix)(bsProps, fluid && 'fluid');

    return _react2.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return Grid;
}(_react2.default.Component);

Grid.propTypes = propTypes;
Grid.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('container', Grid);
module.exports = exports['default'];