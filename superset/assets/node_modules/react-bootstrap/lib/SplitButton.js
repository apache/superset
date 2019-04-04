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

var _Button = require('./Button');

var _Button2 = _interopRequireDefault(_Button);

var _Dropdown = require('./Dropdown');

var _Dropdown2 = _interopRequireDefault(_Dropdown);

var _SplitToggle = require('./SplitToggle');

var _SplitToggle2 = _interopRequireDefault(_SplitToggle);

var _splitComponentProps2 = require('./utils/splitComponentProps');

var _splitComponentProps3 = _interopRequireDefault(_splitComponentProps2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = (0, _extends3.default)({}, _Dropdown2.default.propTypes, {

  // Toggle props.
  bsStyle: _propTypes2.default.string,
  bsSize: _propTypes2.default.string,
  href: _propTypes2.default.string,
  onClick: _propTypes2.default.func,
  /**
   * The content of the split button.
   */
  title: _propTypes2.default.node.isRequired,
  /**
   * Accessible label for the toggle; the value of `title` if not specified.
   */
  toggleLabel: _propTypes2.default.string,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: _propTypes2.default.node
});

var SplitButton = function (_React$Component) {
  (0, _inherits3.default)(SplitButton, _React$Component);

  function SplitButton() {
    (0, _classCallCheck3.default)(this, SplitButton);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  SplitButton.prototype.render = function render() {
    var _props = this.props,
        bsSize = _props.bsSize,
        bsStyle = _props.bsStyle,
        title = _props.title,
        toggleLabel = _props.toggleLabel,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['bsSize', 'bsStyle', 'title', 'toggleLabel', 'children']);

    var _splitComponentProps = (0, _splitComponentProps3.default)(props, _Dropdown2.default.ControlledComponent),
        dropdownProps = _splitComponentProps[0],
        buttonProps = _splitComponentProps[1];

    return _react2.default.createElement(
      _Dropdown2.default,
      (0, _extends3.default)({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      _react2.default.createElement(
        _Button2.default,
        (0, _extends3.default)({}, buttonProps, {
          disabled: props.disabled,
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      _react2.default.createElement(_SplitToggle2.default, {
        'aria-label': toggleLabel || title,
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      _react2.default.createElement(
        _Dropdown2.default.Menu,
        null,
        children
      )
    );
  };

  return SplitButton;
}(_react2.default.Component);

SplitButton.propTypes = propTypes;

SplitButton.Toggle = _SplitToggle2.default;

exports.default = SplitButton;
module.exports = exports['default'];