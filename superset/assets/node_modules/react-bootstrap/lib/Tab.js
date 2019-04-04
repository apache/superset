'use strict';

exports.__esModule = true;

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _TabContainer = require('./TabContainer');

var _TabContainer2 = _interopRequireDefault(_TabContainer);

var _TabContent = require('./TabContent');

var _TabContent2 = _interopRequireDefault(_TabContent);

var _TabPane = require('./TabPane');

var _TabPane2 = _interopRequireDefault(_TabPane);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = (0, _extends3.default)({}, _TabPane2.default.propTypes, {

  disabled: _propTypes2.default.bool,

  title: _propTypes2.default.node,

  /**
   * tabClassName is used as className for the associated NavItem
   */
  tabClassName: _propTypes2.default.string
});

var Tab = function (_React$Component) {
  (0, _inherits3.default)(Tab, _React$Component);

  function Tab() {
    (0, _classCallCheck3.default)(this, Tab);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Tab.prototype.render = function render() {
    var props = (0, _extends3.default)({}, this.props);

    // These props are for the parent `<Tabs>` rather than the `<TabPane>`.
    delete props.title;
    delete props.disabled;
    delete props.tabClassName;

    return _react2.default.createElement(_TabPane2.default, props);
  };

  return Tab;
}(_react2.default.Component);

Tab.propTypes = propTypes;

Tab.Container = _TabContainer2.default;
Tab.Content = _TabContent2.default;
Tab.Pane = _TabPane2.default;

exports.default = Tab;
module.exports = exports['default'];