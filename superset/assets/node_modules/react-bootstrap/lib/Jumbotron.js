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

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  componentClass: _elementType2.default
};

var defaultProps = {
  componentClass: 'div'
};

var Jumbotron = function (_React$Component) {
  (0, _inherits3.default)(Jumbotron, _React$Component);

  function Jumbotron() {
    (0, _classCallCheck3.default)(this, Jumbotron);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Jumbotron.prototype.render = function render() {
    var _props = this.props,
        Component = _props.componentClass,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['componentClass', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return Jumbotron;
}(_react2.default.Component);

Jumbotron.propTypes = propTypes;
Jumbotron.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('jumbotron', Jumbotron);
module.exports = exports['default'];