"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _react = _interopRequireDefault(require("react"));

var _classnames = _interopRequireDefault(require("classnames"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _PanelCollapse = _interopRequireDefault(require("./PanelCollapse"));

var propTypes = {
  /**
   * A convenience prop that renders a Collapse component around the Body for
   * situations when the parent Panel only contains a single Panel.Body child.
   *
   * renders:
   * ```jsx
   * <Panel.Collapse>
   *  <Panel.Body />
   * </Panel.Collapse>
   * ```
   */
  collapsible: _propTypes.default.bool.isRequired
};
var defaultProps = {
  collapsible: false
};
var contextTypes = {
  $bs_panel: _propTypes.default.shape({
    bsClass: _propTypes.default.string
  })
};

var PanelBody =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(PanelBody, _React$Component);

  function PanelBody() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = PanelBody.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        children = _this$props.children,
        className = _this$props.className,
        collapsible = _this$props.collapsible;

    var _ref = this.context.$bs_panel || {},
        _bsClass = _ref.bsClass;

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(this.props, ['collapsible']),
        bsProps = _splitBsPropsAndOmit[0],
        elementProps = _splitBsPropsAndOmit[1];

    bsProps.bsClass = _bsClass || bsProps.bsClass;

    var body = _react.default.createElement("div", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, (0, _bootstrapUtils.prefix)(bsProps, 'body'))
    }), children);

    if (collapsible) {
      body = _react.default.createElement(_PanelCollapse.default, null, body);
    }

    return body;
  };

  return PanelBody;
}(_react.default.Component);

PanelBody.propTypes = propTypes;
PanelBody.defaultProps = defaultProps;
PanelBody.contextTypes = contextTypes;

var _default = (0, _bootstrapUtils.bsClass)('panel', PanelBody);

exports.default = _default;
module.exports = exports["default"];