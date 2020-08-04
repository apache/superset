"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _PagerItem = _interopRequireDefault(require("./PagerItem"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var _createChainedFunction = _interopRequireDefault(require("./utils/createChainedFunction"));

var _ValidComponentChildren = _interopRequireDefault(require("./utils/ValidComponentChildren"));

var propTypes = {
  onSelect: _propTypes.default.func
};

var Pager =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Pager, _React$Component);

  function Pager() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Pager.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        onSelect = _this$props.onSelect,
        className = _this$props.className,
        children = _this$props.children,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["onSelect", "className", "children"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement("ul", (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }), _ValidComponentChildren.default.map(children, function (child) {
      return (0, _react.cloneElement)(child, {
        onSelect: (0, _createChainedFunction.default)(child.props.onSelect, onSelect)
      });
    }));
  };

  return Pager;
}(_react.default.Component);

Pager.propTypes = propTypes;
Pager.Item = _PagerItem.default;

var _default = (0, _bootstrapUtils.bsClass)('pager', Pager);

exports.default = _default;
module.exports = exports["default"];