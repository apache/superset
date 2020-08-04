"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends3 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  striped: _propTypes.default.bool,
  bordered: _propTypes.default.bool,
  condensed: _propTypes.default.bool,
  hover: _propTypes.default.bool,
  responsive: _propTypes.default.bool
};
var defaultProps = {
  bordered: false,
  condensed: false,
  hover: false,
  responsive: false,
  striped: false
};

var Table =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Table, _React$Component);

  function Table() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Table.prototype;

  _proto.render = function render() {
    var _extends2;

    var _this$props = this.props,
        striped = _this$props.striped,
        bordered = _this$props.bordered,
        condensed = _this$props.condensed,
        hover = _this$props.hover,
        responsive = _this$props.responsive,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["striped", "bordered", "condensed", "hover", "responsive", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _extends3.default)({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'striped')] = striped, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'bordered')] = bordered, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'condensed')] = condensed, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'hover')] = hover, _extends2));

    var table = _react.default.createElement("table", (0, _extends3.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));

    if (responsive) {
      return _react.default.createElement("div", {
        className: (0, _bootstrapUtils.prefix)(bsProps, 'responsive')
      }, table);
    }

    return table;
  };

  return Table;
}(_react.default.Component);

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;

var _default = (0, _bootstrapUtils.bsClass)('table', Table);

exports.default = _default;
module.exports = exports["default"];