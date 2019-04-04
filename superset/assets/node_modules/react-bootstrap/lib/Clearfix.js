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

var _capitalize = require('./utils/capitalize');

var _capitalize2 = _interopRequireDefault(_capitalize);

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  componentClass: _elementType2.default,

  /**
   * Apply clearfix
   *
   * on Extra small devices Phones
   *
   * adds class `visible-xs-block`
   */
  visibleXsBlock: _propTypes2.default.bool,
  /**
   * Apply clearfix
   *
   * on Small devices Tablets
   *
   * adds class `visible-sm-block`
   */
  visibleSmBlock: _propTypes2.default.bool,
  /**
   * Apply clearfix
   *
   * on Medium devices Desktops
   *
   * adds class `visible-md-block`
   */
  visibleMdBlock: _propTypes2.default.bool,
  /**
   * Apply clearfix
   *
   * on Large devices Desktops
   *
   * adds class `visible-lg-block`
   */
  visibleLgBlock: _propTypes2.default.bool
};

var defaultProps = {
  componentClass: 'div'
};

var Clearfix = function (_React$Component) {
  (0, _inherits3.default)(Clearfix, _React$Component);

  function Clearfix() {
    (0, _classCallCheck3.default)(this, Clearfix);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Clearfix.prototype.render = function render() {
    var _props = this.props,
        Component = _props.componentClass,
        className = _props.className,
        props = (0, _objectWithoutProperties3.default)(_props, ['componentClass', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    _StyleConfig.DEVICE_SIZES.forEach(function (size) {
      var propName = 'visible' + (0, _capitalize2.default)(size) + 'Block';
      if (elementProps[propName]) {
        classes['visible-' + size + '-block'] = true;
      }

      delete elementProps[propName];
    });

    return _react2.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return Clearfix;
}(_react2.default.Component);

Clearfix.propTypes = propTypes;
Clearfix.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('clearfix', Clearfix);
module.exports = exports['default'];