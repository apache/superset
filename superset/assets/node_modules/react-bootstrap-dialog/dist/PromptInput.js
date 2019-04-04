'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Prompts = require('./Prompts');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var PromptInput = function (_React$Component) {
  (0, _inherits3.default)(PromptInput, _React$Component);

  function PromptInput(props) {
    (0, _classCallCheck3.default)(this, PromptInput);

    var _this = (0, _possibleConstructorReturn3.default)(this, (PromptInput.__proto__ || (0, _getPrototypeOf2.default)(PromptInput)).call(this, props));

    var _props$prompt = props.prompt,
        initialValue = _props$prompt.initialValue,
        placeholder = _props$prompt.placeholder;

    _this.state = {
      value: initialValue || '',
      initialValue: initialValue,
      placeholder: placeholder
    };
    _this.inputElement = null;
    _this.onSubmit = _this.onSubmit.bind(_this);
    return _this;
  }

  (0, _createClass3.default)(PromptInput, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      var _this2 = this;

      this.setState({ value: this.state.initialValue || '' }, function () {
        _this2.inputElement.select();
      });
    }
  }, {
    key: 'onSubmit',
    value: function onSubmit(e) {
      e.preventDefault();
      this.props.onSubmit && this.props.onSubmit();
      return false;
    }
  }, {
    key: 'render',
    value: function render() {
      var _this3 = this;

      var prompt = this.props.prompt;
      var _state = this.state,
          value = _state.value,
          placeholder = _state.placeholder;

      var type = prompt instanceof _Prompts.PasswordPrompt ? 'password' : 'text';
      return _react2.default.createElement(
        'form',
        { onSubmit: this.onSubmit },
        _react2.default.createElement('input', {
          ref: function ref(el) {
            _this3.inputElement = el;
          },
          type: type,
          className: 'form-control',
          value: value,
          placeholder: placeholder,
          onChange: function onChange(e) {
            return _this3.setState({ value: e.target.value });
          },
          autoFocus: true
        })
      );
    }
  }, {
    key: 'value',
    get: function get() {
      return this.state.value;
    }
  }]);
  return PromptInput;
}(_react2.default.Component);

exports.default = PromptInput;