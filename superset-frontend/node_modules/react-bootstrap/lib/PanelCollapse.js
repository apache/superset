"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _Collapse = _interopRequireDefault(require("./Collapse"));

var propTypes = {
  /**
   * Callback fired before the component expands
   */
  onEnter: _propTypes.default.func,

  /**
   * Callback fired after the component starts to expand
   */
  onEntering: _propTypes.default.func,

  /**
   * Callback fired after the component has expanded
   */
  onEntered: _propTypes.default.func,

  /**
   * Callback fired before the component collapses
   */
  onExit: _propTypes.default.func,

  /**
   * Callback fired after the component starts to collapse
   */
  onExiting: _propTypes.default.func,

  /**
   * Callback fired after the component has collapsed
   */
  onExited: _propTypes.default.func
};
var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    headingId: _propTypes.default.string,
    bodyId: _propTypes.default.string,
    bsClass: _propTypes.default.string,
    expanded: _propTypes.default.bool
  })
};

var PanelCollapse =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelCollapse, _React$Component);

  function PanelCollapse() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelCollapse.prototype;

  _proto.render = function render() {
    var children = this.props.children;

    var _ref = this.context.$bs_panel || {},
        headingId = _ref.headingId,
        bodyId = _ref.bodyId,
        _bsClass = _ref.bsClass,
        expanded = _ref.expanded;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(this.props),
        bsProps = _splitBsProps[0],
        props = _splitBsProps[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    if (headingId && bodyId) {
      props.id = bodyId;
      props.role = props.role || 'tabpanel';
      props['aria-labelledby'] = headingId;
    }

    return _react.default.createElement(_Collapse.default, (0, _extends2.default)({
      in: expanded
    }, props), _react.default.createElement("div", {
      className: (0, _bootstrapUtils.prefix)(bsProps, 'collapse')
    }, children));
  };

  return PanelCollapse;
}(_react.default.Component);

PanelCollapse.propTypes = propTypes;
PanelCollapse.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('panel', PanelCollapse);

exports.default = _default;
module.exports = exports["default"];