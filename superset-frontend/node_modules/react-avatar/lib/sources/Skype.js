'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _propTypes = _interopRequireDefault(require("prop-types"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var SkypeSource = function SkypeSource(props) {
  var _this = this;

  _classCallCheck(this, SkypeSource);

  _defineProperty(this, "props", null);

  _defineProperty(this, "isCompatible", function () {
    return !!_this.props.skypeId;
  });

  _defineProperty(this, "get", function (setState) {
    var skypeId = _this.props.skypeId;
    var url = "https://api.skype.com/users/".concat(skypeId, "/profile/avatar");
    setState({
      sourceName: 'skype',
      src: url
    });
  });

  this.props = props;
};

exports.default = SkypeSource;

_defineProperty(SkypeSource, "propTypes", {
  skypeId: _propTypes.default.string
});