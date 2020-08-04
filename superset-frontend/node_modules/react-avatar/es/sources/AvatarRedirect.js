'use strict';

import "core-js/modules/es.array.concat";
import "core-js/modules/es.regexp.exec";
import "core-js/modules/es.string.replace";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import PropTypes from 'prop-types';
import { getImageSize } from '../utils';
export default function createRedirectSource(network, property) {
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
      var size = getImageSize(_this.props.size);
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
  }, _defineProperty(_class, "propTypes", _defineProperty({}, property, PropTypes.oneOfType([PropTypes.string, PropTypes.number]))), _temp;
}