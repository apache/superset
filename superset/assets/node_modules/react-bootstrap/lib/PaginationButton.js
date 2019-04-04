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

var _SafeAnchor = require('./SafeAnchor');

var _SafeAnchor2 = _interopRequireDefault(_SafeAnchor);

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: This should be `<Pagination.Item>`.

// TODO: This should use `componentClass` like other components.

var propTypes = {
  componentClass: _elementType2.default,
  className: _propTypes2.default.string,
  eventKey: _propTypes2.default.any,
  onSelect: _propTypes2.default.func,
  disabled: _propTypes2.default.bool,
  active: _propTypes2.default.bool,
  onClick: _propTypes2.default.func
};

var defaultProps = {
  componentClass: _SafeAnchor2.default,
  active: false,
  disabled: false
};

var PaginationButton = function (_React$Component) {
  (0, _inherits3.default)(PaginationButton, _React$Component);

  function PaginationButton(props, context) {
    (0, _classCallCheck3.default)(this, PaginationButton);

    var _this = (0, _possibleConstructorReturn3.default)(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  PaginationButton.prototype.handleClick = function handleClick(event) {
    var _props = this.props,
        disabled = _props.disabled,
        onSelect = _props.onSelect,
        eventKey = _props.eventKey;


    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, event);
    }
  };

  PaginationButton.prototype.render = function render() {
    var _props2 = this.props,
        Component = _props2.componentClass,
        active = _props2.active,
        disabled = _props2.disabled,
        onClick = _props2.onClick,
        className = _props2.className,
        style = _props2.style,
        props = (0, _objectWithoutProperties3.default)(_props2, ['componentClass', 'active', 'disabled', 'onClick', 'className', 'style']);


    if (Component === _SafeAnchor2.default) {
      // Assume that custom components want `eventKey`.
      delete props.eventKey;
    }

    delete props.onSelect;

    return _react2.default.createElement(
      'li',
      {
        className: (0, _classnames2.default)(className, { active: active, disabled: disabled }),
        style: style
      },
      _react2.default.createElement(Component, (0, _extends3.default)({}, props, {
        disabled: disabled,
        onClick: (0, _createChainedFunction2.default)(onClick, this.handleClick)
      }))
    );
  };

  return PaginationButton;
}(_react2.default.Component);

PaginationButton.propTypes = propTypes;
PaginationButton.defaultProps = defaultProps;

exports.default = PaginationButton;
module.exports = exports['default'];