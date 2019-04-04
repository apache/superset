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

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  inline: _propTypes2.default.bool,
  disabled: _propTypes2.default.bool,
  title: _propTypes2.default.string,
  /**
   * Only valid if `inline` is not set.
   */
  validationState: _propTypes2.default.oneOf(['success', 'warning', 'error', null]),
  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <Radio inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: _propTypes2.default.func
}; /* eslint-disable jsx-a11y/label-has-for */

var defaultProps = {
  inline: false,
  disabled: false,
  title: ''
};

var Radio = function (_React$Component) {
  (0, _inherits3.default)(Radio, _React$Component);

  function Radio() {
    (0, _classCallCheck3.default)(this, Radio);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  Radio.prototype.render = function render() {
    var _props = this.props,
        inline = _props.inline,
        disabled = _props.disabled,
        validationState = _props.validationState,
        inputRef = _props.inputRef,
        className = _props.className,
        style = _props.style,
        title = _props.title,
        children = _props.children,
        props = (0, _objectWithoutProperties3.default)(_props, ['inline', 'disabled', 'validationState', 'inputRef', 'className', 'style', 'title', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var input = _react2.default.createElement('input', (0, _extends3.default)({}, elementProps, {
      ref: inputRef,
      type: 'radio',
      disabled: disabled
    }));

    if (inline) {
      var _classes2;

      var _classes = (_classes2 = {}, _classes2[(0, _bootstrapUtils.prefix)(bsProps, 'inline')] = true, _classes2.disabled = disabled, _classes2);

      // Use a warning here instead of in propTypes to get better-looking
      // generated documentation.
      process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(!validationState, '`validationState` is ignored on `<Radio inline>`. To display ' + 'validation state on an inline radio, set `validationState` on a ' + 'parent `<FormGroup>` or other element instead.') : void 0;

      return _react2.default.createElement(
        'label',
        { className: (0, _classnames2.default)(className, _classes), style: style, title: title },
        input,
        children
      );
    }

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      disabled: disabled
    });
    if (validationState) {
      classes['has-' + validationState] = true;
    }

    return _react2.default.createElement(
      'div',
      { className: (0, _classnames2.default)(className, classes), style: style },
      _react2.default.createElement(
        'label',
        { title: title },
        input,
        children
      )
    );
  };

  return Radio;
}(_react2.default.Component);

Radio.propTypes = propTypes;
Radio.defaultProps = defaultProps;

exports.default = (0, _bootstrapUtils.bsClass)('radio', Radio);
module.exports = exports['default'];