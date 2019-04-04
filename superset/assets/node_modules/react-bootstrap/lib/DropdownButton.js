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

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _Dropdown = require('./Dropdown');

var _Dropdown2 = _interopRequireDefault(_Dropdown);

var _splitComponentProps2 = require('./utils/splitComponentProps');

var _splitComponentProps3 = _interopRequireDefault(_splitComponentProps2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = (0, _extends3.default)({}, _Dropdown2.default.propTypes, {

  // Toggle props.
  bsStyle: _propTypes2.default.string,
  bsSize: _propTypes2.default.string,
  title: _propTypes2.default.node.isRequired,
  noCaret: _propTypes2.default.bool,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: _propTypes2.default.node
});

var DropdownButton = function (_React$Component) {
  (0, _inherits3.default)(DropdownButton, _React$Component);

  function DropdownButton() {
    (0, _classCallCheck3.default)(this, DropdownButton);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  DropdownButton.prototype.render = function render() {
    var _props = this.props,
        bsSize = _props.bsSize,
        bsStyle = _props.bsStyle,
        title = _props.title,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['bsSize', 'bsStyle', 'title', 'children']);

    var _splitComponentProps = (0, _splitComponentProps3.default)(props, _Dropdown2.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        toggleProps = _splitComponentProps[1];

    return _react2.default.createElement(
      _Dropdown2.default,
      (0, _extends3.default)({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      _react2.default.createElement(
        _Dropdown2.default.Toggle,
        (0, _extends3.default)({}, toggleProps, {
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      _react2.default.createElement(
        _Dropdown2.default.Menu,
        null,
        children
      )
    );
  };

  return DropdownButton;
}(_react2.default.Component);

DropdownButton.propTypes = propTypes;

exports.default = DropdownButton;
module.exports = exports['default'];