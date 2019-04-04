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

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _Dropdown = require('./Dropdown');

var _Dropdown2 = _interopRequireDefault(_Dropdown);

var _splitComponentProps2 = require('./utils/splitComponentProps');

var _splitComponentProps3 = _interopRequireDefault(_splitComponentProps2);

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = (0, _extends3.default)({}, _Dropdown2.default.propTypes, {

  // Toggle props.
  title: _propTypes2.default.node.isRequired,
  noCaret: _propTypes2.default.bool,
  active: _propTypes2.default.bool,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: _propTypes2.default.node
});

var NavDropdown = function (_React$Component) {
  (0, _inherits3.default)(NavDropdown, _React$Component);

  function NavDropdown() {
    (0, _classCallCheck3.default)(this, NavDropdown);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  NavDropdown.prototype.isActive = function isActive(_ref, activeKey, activeHref) {
    var props = _ref.props;

    var _this2 = this;

    if (props.active || activeKey != null && props.eventKey === activeKey || activeHref && props.href === activeHref) {
      return true;
    }

    if (_ValidComponentChildren2.default.some(props.children, function (child) {
      return _this2.isActive(child, activeKey, activeHref);
    })) {
      return true;
    }

    return props.active;
  };

  NavDropdown.prototype.render = function render() {
    var _this3 = this;

    var _props = this.props,
        title = _props.title,
        activeKey = _props.activeKey,
        activeHref = _props.activeHref,
        className = _props.className,
        style = _props.style,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['title', 'activeKey', 'activeHref', 'className', 'style', 'children']);


    var active = this.isActive(this, activeKey, activeHref);
    delete props.active; // Accessed via this.isActive().
    delete props.eventKey; // Accessed via this.isActive().

    var _splitComponentProps = (0, _splitComponentProps3.default)(props, _Dropdown2.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1];

    // Unlike for the other dropdowns, styling needs to go to the `<Dropdown>`
    // rather than the `<Dropdown.Toggle>`.

    return _react2.default.createElement(
      _Dropdown2.default,
      (0, _extends3.default)({}, dropdownProps, {
        componentClass: 'li',
        className: (0, _classnames2.default)(className, { active: active }),
        style: style
      }),
      _react2.default.createElement(
        _Dropdown2.default.Toggle,
        (0, _extends3.default)({}, toggleProps, { useAnchor: true }),
        title
      ),
      _react2.default.createElement(
        _Dropdown2.default.Menu,
        null,
        _ValidComponentChildren2.default.map(children, function (child) {
          return _react2.default.cloneElement(child, {
            active: _this3.isActive(child, activeKey, activeHref)
          });
        })
      )
    );
  };

  return NavDropdown;
}(_react2.default.Component);

NavDropdown.propTypes = propTypes;

exports.default = NavDropdown;
module.exports = exports['default'];