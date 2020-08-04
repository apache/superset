'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var IconSource = function IconSource(props) {
  var _this = this;

  _classCallCheck(this, IconSource);

  _defineProperty(this, "props", null);

  _defineProperty(this, "icon", '✷');

  _defineProperty(this, "isCompatible", function () {
    return true;
  });

  _defineProperty(this, "get", function (setState) {
    var _this$props = _this.props,
        color = _this$props.color,
        colors = _this$props.colors;
    setState({
      sourceName: 'icon',
      value: _this.icon,
      color: color || (0, _utils.getRandomColor)(_this.icon, colors)
    });
  });

  this.props = props;
};

exports.default = IconSource;

_defineProperty(IconSource, "propTypes", {
  color: _propTypes.default.string
});