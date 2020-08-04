"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _extends2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/extends"));

var _objectWithoutPropertiesLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/objectWithoutPropertiesLoose"));

var _inheritsLoose2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/inheritsLoose"));

var _classnames = _interopRequireDefault(require("classnames"));

var _react = _interopRequireDefault(require("react"));

var _elementType = _interopRequireDefault(require("prop-types-extra/lib/elementType"));

var _MediaBody = _interopRequireDefault(require("./MediaBody"));

var _MediaHeading = _interopRequireDefault(require("./MediaHeading"));

var _MediaLeft = _interopRequireDefault(require("./MediaLeft"));

var _MediaList = _interopRequireDefault(require("./MediaList"));

var _MediaListItem = _interopRequireDefault(require("./MediaListItem"));

var _MediaRight = _interopRequireDefault(require("./MediaRight"));

var _bootstrapUtils = require("./utils/bootstrapUtils");

var propTypes = {
  componentClass: _elementType.default
};
var defaultProps = {
  componentClass: 'div'
};

var Media =
/*#__PURE__*/
function (_React$Component) {
  (0, _inheritsLoose2.default)(Media, _React$Component);

  function Media() {
    return _React$Component.apply(this, arguments) || this;
  }

  var _proto = Media.prototype;

  _proto.render = function render() {
    var _this$props = this.props,
        Component = _this$props.componentClass,
        className = _this$props.className,
        props = (0, _objectWithoutPropertiesLoose2.default)(_this$props, ["componentClass", "className"]);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props),
        bsProps = _splitBsProps[0],
        elementProps = _splitBsProps[1];

    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    return _react.default.createElement(Component, (0, _extends2.default)({}, elementProps, {
      className: (0, _classnames.default)(className, classes)
    }));
  };

  return Media;
}(_react.default.Component);

Media.propTypes = propTypes;
Media.defaultProps = defaultProps;
Media.Heading = _MediaHeading.default;
Media.Body = _MediaBody.default;
Media.Left = _MediaLeft.default;
Media.Right = _MediaRight.default;
Media.List = _MediaList.default;
Media.ListItem = _MediaListItem.default;

var _default = (0, _bootstrapUtils.bsClass)('media', Media);

exports.default = _default;
module.exports = exports["default"];