"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var propTypes = {
  disabled: _propTypes.default.bool,
  previous: _propTypes.default.bool,
  next: _propTypes.default.bool,
  onClick: _propTypes.default.func,
  onSelect: _propTypes.default.func,
  eventKey: _propTypes.default.any
};
var defaultProps = {
  disabled: false,
  previous: false,
  next: false
};

var PagerItem =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PagerItem, _React$Component);

  function PagerItem(props, context) {
    var _this;

    _this = _React$Component.call(this, props, context) || this;
    _this.handleSelect = _this.handleSelect.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    return _this;
  }

  var _proto = PagerItem.prototype;

  _proto.handleSelect = function handleSelect(e) {
    var _this$props = this.props,
        disabled = _this$props.disabled,
        onSelect = _this$props.onSelect,
        eventKey = _this$props.eventKey;

    if (disabled) {
      e.preventDefault();
      return;
    }

    if (onSelect) {
      onSelect(eventKey, e);
    }
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        disabled = _this$props2.disabled,
        previous = _this$props2.previous,
        next = _this$props2.next,
        onClick = _this$props2.onClick,
        className = _this$props2.className,
        style = _this$props2.style,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props2, ["disabled", "previous", "next", "onClick", "className", "style"]);
    delete props.onSelect;
    delete props.eventKey;
    return _react.default.createElement("li", {
      className: (0, _classnames.default)(className, {
        disabled: disabled,
        previous: previous,
        next: next
      }),
      style: style
    }, _react.default.createElement(_SafeAnchor.default, (0, _extends2.default)({}, props, {
      disabled: disabled,
      onClick: (0, _createChainedFunction.default)(onClick, this.handleSelect)
    })));
  };

  return PagerItem;
}(_react.default.Component);

PagerItem.propTypes = propTypes;
PagerItem.defaultProps = defaultProps;
var _default = PagerItem;
exports.default = _default;
module.exports = exports["default"];