'use strict';

require("core-js/modules/es.array.concat");

require("core-js/modules/es.regexp.exec");

require("core-js/modules/es.string.replace");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createRedirectSource;

var _propTypes = _interopRequireDefault(require("prop-types"));

var _utils = require("../utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function createRedirectSource(network, property) {
  var _class, _temp;

  return _temp = _class = function AvatarRedirectSource(props) {
    var _this = this;

    _classCallCheck(this, AvatarRedirectSource);

    _defineProperty(this, "props", null);

    _defineProperty(this, "isCompatible", function () {
      return !!_this.props.avatarRedirectUrl && !!_this.props[property];
    });

    _defineProperty(this, "get", function (setState) {
      var avatarRedirectUrl = _this.props.avatarRedirectUrl;
      var size = (0, _utils.getImageSize)(_this.props.size);
      var baseUrl = avatarRedirectUrl.replace(/\/*$/, '/');
      var id = _this.props[property];
      var query = size ? "size=".concat(size) : '';
      var src = "".concat(baseUrl).concat(network, "/").concat(id, "?").concat(query);
      setState({
        source: 'network',
        src: src
      });
    });

    this.props = props;
  }, _defineProperty(_class, "propTypes", _defineProperty({}, property, _propTypes.default.oneOfType([_propTypes.default.string, _propTypes.default.number]))), _temp;
}