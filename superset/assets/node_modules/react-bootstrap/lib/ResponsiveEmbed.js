'use strict';

exports.__esModule = true;

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

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: This should probably take a single `aspectRatio` prop.

var propTypes = {
  /**
   * This component requires a single child element
   */
  children: _propTypes2.default.element.isRequired,
  /**
   * 16by9 aspect ratio
   */
  a16by9: _propTypes2.default.bool,
  /**
   * 4by3 aspect ratio
   */
  a4by3: _propTypes2.default.bool
};

var defaultProps = {
  a16by9: false,
  a4by3: false
};

var ResponsiveEmbed = function (_React$Component) {
  (0, _inherits3.default)(ResponsiveEmbed, _React$Component);

  function ResponsiveEmbed() {
    (0, _classCallCheck3.default)(this, ResponsiveEmbed);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  ResponsiveEmbed.prototype.render = function render() {
    var _extends2;

    var _props = this.props,
        a16by9 = _props.a16by9,
        a4by3 = _props.a4by3,
        className = _props.className,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['a16by9', 'a4by3', 'className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(a16by9 || a4by3, 'Either `a16by9` or `a4by3` must be set.') : void 0;
    process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(!(a16by9 && a4by3), 'Only one of `a16by9` or `a4by3` can be set.') : void 0;

    var classes = (0, _extends4.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, '16by9')] = a16by9, _extends2[(0, _bootstrapUtils.prefix)(bsProps, '4by3')] = a4by3, _extends2));

    return _react2.default.createElement(
      'div',
      { className: (0, _classnames2.default)(classes) },
      (0, _react.cloneElement)(children, (0, _extends4.default)({}, elementProps, {
        className: (0, _classnames2.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'item'))
      }))
    );
  };

  return ResponsiveEmbed;
}(_react2.default.Component);

ResponsiveEmbed.propTypes = propTypes;
ResponsiveEmbed.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('embed-responsive', ResponsiveEmbed);
module.exports = exports['default'];