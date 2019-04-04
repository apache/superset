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

var _elementType = require('prop-types-extra/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _FormControlFeedback = require('./FormControlFeedback');

var _FormControlFeedback2 = _interopRequireDefault(_FormControlFeedback);

var _FormControlStatic = require('./FormControlStatic');

var _FormControlStatic2 = _interopRequireDefault(_FormControlStatic);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var propTypes = {
  componentClass: _elementType2.default,
  /**
   * Only relevant if `componentClass` is `'input'`.
   */
  type: _propTypes2.default.string,
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  id: _propTypes2.default.string,
  /**
   * Attaches a ref to the `<input>` element. Only functions can be used here.
   *
   * ```js
   * <FormControl inputRef={ref => { this.input = ref; }} />
   * ```
   */
  inputRef: _propTypes2.default.func
};

var defaultProps = {
  componentClass: 'input'
};

var contextTypes = {
  $bs_formGroup: _propTypes2.default.object
};

var FormControl = function (_React$Component) {
  (0, _inherits3.default)(FormControl, _React$Component);

  function FormControl() {
    (0, _classCallCheck3.default)(this, FormControl);
    return (0, _possibleConstructorReturn3.default)(this, _React$Component.apply(this, arguments));
  }

  FormControl.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props,
        Component = _props.componentClass,
        type = _props.type,
        _props$id = _props.id,
        id = _props$id === undefined ? controlId : _props$id,
        inputRef = _props.inputRef,
        className = _props.className,
        bsSize = _props.bsSize,
        props = (0, _objectWithoutProperties3.default)(_props, ['componentClass', 'type', 'id', 'inputRef', 'className', 'bsSize']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    process.env.NODE_ENV !== 'production' ? (0, _warning2.default)(controlId == null || id === controlId, '`controlId` is ignored on `<FormControl>` when `id` is specified.') : void 0;

    // input[type="file"] should not have .form-control.
    var classes = void 0;
    if (type !== 'file') {
      classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    }

    // If user provides a size, make sure to append it to classes as input-
    // e.g. if bsSize is small, it will append input-sm
    if (bsSize) {
      var size = _StyleConfig.SIZE_MAP[bsSize] || bsSize;
      classes[(0, _bootstrapUtils.prefix)({ bsClass: 'input' }, size)] = true;
    }

    return _react2.default.createElement(Component, (0, _extends3.default)({}, elementProps, {
      type: type,
      id: id,
      ref: inputRef,
      className: (0, _classnames2.default)(className, classes)
    }));
  };

  return FormControl;
}(_react2.default.Component);

FormControl.propTypes = propTypes;
FormControl.defaultProps = defaultProps;
FormControl.contextTypes = contextTypes;

FormControl.Feedback = _FormControlFeedback2.default;
FormControl.Static = _FormControlStatic2.default;

exports.default = (0, _bootstrapUtils.bsClass)('form-control', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.SMALL, _StyleConfig.Size.LARGE], FormControl));
module.exports = exports['default'];