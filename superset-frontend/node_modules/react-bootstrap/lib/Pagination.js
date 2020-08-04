"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _PaginationItem = _interopRequireWildcard(require("./PaginationItem"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var Pagination =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Pagination, _React$Component);

  function Pagination() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Pagination.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement("ul", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), children);
  };

  return Pagination;
}(_react.default.Component);

(0, _bootstrapUtils.bsClass)('pagination', Pagination);
Pagination.First = _PaginationItem.First;
Pagination.Prev = _PaginationItem.Prev;
Pagination.Ellipsis = _PaginationItem.Ellipsis;
Pagination.Item = _PaginationItem.default;
Pagination.Next = _PaginationItem.Next;
Pagination.Last = _PaginationItem.Last;
var _default = Pagination;
exports.default = _default;
module.exports = exports["default"];