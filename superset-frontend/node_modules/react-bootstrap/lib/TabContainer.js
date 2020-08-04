"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _uncontrollable = require("uncontrollable");

var TAB = 'tab';
var PANE = 'pane';

var idPropType = _propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.number]);

var propTypes = {
  /**
   * HTML id attribute, required if no `generateChildId` prop
   * is specified.
   */
  id: function id(props) {
    var error = null;

    if (!props.generateChildId) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      error = idPropType.apply(void 0, [props].concat(args));

      if (!error && !props.id) {
        error = new Error('In order to properly initialize Tabs in a way that is accessible ' + 'to assistive technologies (such as screen readers) an `id` or a ' + '`generateChildId` prop to TabContainer is required');
      }
    }

    return error;
  },

  /**
   * A function that takes an `eventKey` and `type` and returns a unique id for
   * child tab `<NavItem>`s and `<TabPane>`s. The function _must_ be a pure
   * function, meaning it should always return the _same_ id for the same set
   * of inputs. The default value requires that an `id` to be set for the
   * `<TabContainer>`.
   *
   * The `type` argument will either be `"tab"` or `"pane"`.
   *
   * @defaultValue (eventKey, type) => `${this.props.id}-${type}-${key}`
   */
  generateChildId: _propTypes.default.func,

  /**
   * A callback fired when a tab is selected.
   *
   * @controllable activeKey
   */
  onSelect: _propTypes.default.func,

  /**
   * The `eventKey` of the currently active tab.
   *
   * @controllable onSelect
   */
  activeKey: _propTypes.default.any
};
var childContextTypes = {
  $bs_tabContainer: _propTypes.default.shape({
    activeKey: _propTypes.default.any,
    onSelect: _propTypes.default.func.isRequired,
    getTabId: _propTypes.default.func.isRequired,
    getPaneId: _propTypes.default.func.isRequired
  })
};

var TabContainer =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(TabContainer, _React$Component);

  function TabContainer() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = TabContainer.prototype;

  _proto.getChildContext = function getChildContext() {
    var _this$props = this.props,
        activeKey = _this$props.activeKey,
        onSelect = _this$props.onSelect,
        generateChildId = _this$props.generateChildId,
        id = _this$props.id;

    var getId = generateChildId || function (key, type) {
      return id ? id + "-" + type + "-" + key : null;
    };

    return {
      $bs_tabContainer: {
        activeKey: activeKey,
        onSelect: onSelect,
        getTabId: function getTabId(key) {
          return getId(key, TAB);
        },
        getPaneId: function getPaneId(key) {
          return getId(key, PANE);
        }
      }
    };
  };

  _proto.render = function render() {
    var _this$props2 = this.props,
        children = _this$props2.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props2, ["children"]);
    delete props.generateChildId;
    delete props.onSelect;
    delete props.activeKey;
    return _react.default.cloneElement(_react.default.Children.only(children), props);
  };

  return TabContainer;
}(_react.default.Component);

TabContainer.propTypes = propTypes;
TabContainer.childContextTypes = childContextTypes;

var _default = (0, _uncontrollable.uncontrollable)(TabContainer, {
  activeKey: 'onSelect'
});

exports.default = _default;
module.exports = exports["default"];