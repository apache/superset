"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _assertThisInitialized2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/assertThisInitialized"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _classnames = _interopRequireDefault(require("classnames"));

var _elementType = _interopRequireDefault(require("react-prop-types/lib/elementType"));

var _SafeAnchor = _interopRequireDefault(require("./SafeAnchor"));

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var propTypes = {
  /**
   * only here to satisfy linting, just the html onClick handler.
   *
   * @private
   */
  onClick: _propTypes.default.func,

  /**
   * You can use a custom element for this component
   */
  componentClass: _elementType.default
};
var defaultProps = {
  componentClass: _SafeAnchor.default
};
var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    bodyId: _propTypes.default.string,
    onToggle: _propTypes.default.func,
    expanded: _propTypes.default.bool
  })
};

var PanelToggle =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelToggle, _React$Component);

  function PanelToggle() {
    var _this;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = _React$Component.call.apply(_React$Component, [this].concat(args)) || this;
    _this.handleToggle = _this.handleToggle.bind((0, _assertThisInitialized2.default)((0, _assertThisInitialized2.default)(_this)));
    return _this;
  }

  var _proto = PanelToggle.prototype;

  _proto.handleToggle = function handleToggle(event) {
    var _ref = this.context.$bs_panel || {},
        onToggle = _ref.onToggle;

    if (onToggle) {
      onToggle(event);
    }
  };

  _proto.render = function render() {
    var _this$props = this.props,
        onClick = _this$props.onClick,
        className = _this$props.className,
        componentClass = _this$props.componentClass,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["onClick", "className", "componentClass"]);

    var _ref2 = this.context.$bs_panel || {},
        expanded = _ref2.expanded,
        bodyId = _ref2.bodyId;

    var Component = componentClass;
    props.onClick = (0, _createChainedFunction.default)(onClick, this.handleToggle);
    props['aria-expanded'] = expanded;
    props.className = (0, _classnames.default)(className, !expanded && 'collapsed');

    if (bodyId) {
      props['aria-controls'] = bodyId;
    }

    return _react.default.createElement(Component, props);
  };

  return PanelToggle;
}(_react.default.Component);

PanelToggle.propTypes = propTypes;
PanelToggle.defaultProps = defaultProps;
PanelToggle.contextTypes = contextTypes;
var _default = PanelToggle;
exports.default = _default;
module.exports = exports["default"];