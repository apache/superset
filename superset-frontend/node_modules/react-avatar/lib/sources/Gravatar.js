'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _md = _interopRequireDefault(require("md5"));

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var GravatarSource = function GravatarSource(_props) {
  var _this = this;

  _classCallCheck(this, GravatarSource);

  _defineProperty(this, "props", null);

  _defineProperty(this, "isCompatible", function () {
    return !!_this.props.email || !!_this.props.md5Email;
  });

  _defineProperty(this, "get", function (setState) {
    var props = _this.props;
    var email = props.md5Email || (0, _md.default)(props.email);
    var size = (0, _utils.getImageSize)(props.size);
    var url = "https://secure.gravatar.com/avatar/".concat(email, "?d=404");
    if (size) url += "&s=".concat(size);
    setState({
      sourceName: 'gravatar',
      src: url
    });
  });

  this.props = _props;
};

exports.default = GravatarSource;

_defineProperty(GravatarSource, "propTypes", {
  email: _propTypes.default.string,
  md5Email: _propTypes.default.string
});