'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _uncontrollable = require('uncontrollable');

var _uncontrollable2 = _interopRequireDefault(_uncontrollable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TAB = 'tab';
var PANE = 'pane';

var idPropType = _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number]);

var propTypes = {
  /**
   * HTML id attribute, required if no `generateChildId` prop
   * is specified.
   */
  id: function id(props) {
    var error = null;

    if (!props.generateChildId) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      error = idPropType.apply(undefined, [props].concat(args));

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
  generateChildId: _propTypes2.default.func,

  /**
   * A callback fired when a tab is selected.
   *
   * @controllable activeKey
   */
  onSelect: _propTypes2.default.func,

  /**
   * The `eventKey` of the currently active tab.
   *
   * @controllable onSelect
   */
  activeKey: _propTypes2.default.any
};

var childContextTypes = {
  $bs_tabContainer: _propTypes2.default.shape({
    activeKey: _propTypes2.default.any,
    onSelect: _propTypes2.default.func.isRequired,
    getTabId: _propTypes2.default.func.isRequired,
    getPaneId: _propTypes2.default.func.isRequired
  })
};

var TabContainer = function (_React$Component) {
  (0, _inherits3.default)(TabContainer, _React$Component);

  function TabContainer() {
    (0, _classCallCheck3.default)(this, TabContainer);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  TabContainer.prototype.getChildContext = function getChildContext() {
    var _props = this.props,
        activeKey = _props.activeKey,
        onSelect = _props.onSelect,
        generateChildId = _props.generateChildId,
        id = _props.id;


    var getId = generateChildId || function (key, type) {
      return id ? id + '-' + type + '-' + key : null;
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

  TabContainer.prototype.render = function render() {
    var _props2 = this.props,
        children = _props2.children,
        props = (0, _objectWithoutProperties3.default)(_props2, ['children']);


    delete props.generateChildId;
    delete props.onSelect;
    delete props.activeKey;

    return _react2.default.cloneElement(_react2.default.Children.only(children), props);
  };

  return TabContainer;
}(_react2.default.Component);

TabContainer.propTypes = propTypes;
TabContainer.childContextTypes = childContextTypes;

exports.default = (0, _uncontrollable2.default)(TabContainer, { activeKey: 'onSelect' });
module.exports = exports['default'];