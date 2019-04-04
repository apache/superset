'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Button = require('./Button');

var _Button2 = _interopRequireDefault(_Button);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  /**
   * The `<input>` `type`
   * @type {[type]}
   */
  type: _propTypes2.default.oneOf(['checkbox', 'radio']),

  /**
   * The HTML input name, used to group like checkboxes or radio buttons together
   * semantically
   */
  name: _propTypes2.default.string,

  /**
   * The checked state of the input, managed by `<ToggleButtonGroup>`` automatically
   */
  checked: _propTypes2.default.bool,

  /**
   * The disabled state of both the label and input
   */
  disabled: _propTypes2.default.bool,

  /**
   * [onChange description]
   */
  onChange: _propTypes2.default.func,
  /**
   * The value of the input, and unique identifier in the ToggleButtonGroup
   */
  value: _propTypes2.default.any.isRequired
};

var ToggleButton = function (_React$Component) {
  (0, _inherits3.default)(ToggleButton, _React$Component);

  function ToggleButton() {
    (0, _classCallCheck3.default)(this, ToggleButton);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  ToggleButton.prototype.render = function render() {
    var _props = this.props,
        children = _props.children,
        name = _props.name,
        checked = _props.checked,
        type = _props.type,
        onChange = _props.onChange,
        value = _props.value,
        props = (0, _objectWithoutProperties3.default)(_props, ['children', 'name', 'checked', 'type', 'onChange', 'value']);

    var disabled = props.disabled;

    return _react2.default.createElement(
      _Button2.default,
      (0, _extends3.default)({}, props, {
        active: !!checked,
        componentClass: 'label'
      }),
      _react2.default.createElement('input', {
        name: name,
        type: type,
        autoComplete: 'off',
        value: value,
        checked: !!checked,
        disabled: !!disabled,
        onChange: onChange
      }),
      children
    );
  };

  return ToggleButton;
}(_react2.default.Component);

ToggleButton.propTypes = propTypes;

exports.default = ToggleButton;
module.exports = exports['default'];