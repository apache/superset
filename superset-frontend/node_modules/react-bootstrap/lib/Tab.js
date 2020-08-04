"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _TabContainer = _interopRequireDefault(require("./TabContainer"));

var _TabContent = _interopRequireDefault(require("./TabContent"));

var _TabPane = _interopRequireDefault(require("./TabPane"));

var propTypes = (0, _extends2.default)({}, _TabPane.default.propTypes, {
  disabled: _propTypes.default.bool,
  title: _propTypes.default.node,

  /**
   * tabClassName is used as className for the associated NavItem
   */
  tabClassName: _propTypes.default.string
});

var Tab =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Tab, _React$Component);

  function Tab() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Tab.prototype;

  _proto.render = function render() {
    var props = (0, _extends2.default)({}, this.props); // These props are for the parent `<Tabs>` rather than the `<TabPane>`.

    delete props.title;
    delete props.disabled;
    delete props.tabClassName;
    return _react.default.createElement(_TabPane.default, props);
  };

  return Tab;
}(_react.default.Component);

Tab.propTypes = propTypes;
Tab.Container = _TabContainer.default;
Tab.Content = _TabContent.default;
Tab.Pane = _TabPane.default;
var _default = Tab;
exports.default = _default;
module.exports = exports["default"];