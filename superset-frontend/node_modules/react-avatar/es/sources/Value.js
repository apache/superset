'use strict';

import "core-js/modules/es.function.name";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

import PropTypes from 'prop-types';
import { getRandomColor, defaultInitials } from '../utils';

var ValueSource = /*#__PURE__*/function () {
  function ValueSource(props) {
    var _this = this;

    _classCallCheck(this, ValueSource);

    _defineProperty(this, "props", null);

    _defineProperty(this, "isCompatible", function () {
      return !!(_this.props.name || _this.props.value || _this.props.email);
    });

    _defineProperty(this, "get", function (setState) {
      var value = _this.getValue();

      if (!value) return setState(null);
      setState({
        sourceName: 'text',
        value: value,
        color: _this.getColor()
      });
    });

    this.props = props;
  }

  _createClass(ValueSource, [{
    key: "getInitials",
    value: function getInitials() {
      var _this$props = this.props,
          name = _this$props.name,
          initials = _this$props.initials;
      if (typeof initials === 'string') return initials;
      if (typeof initials === 'function') return initials(name, this.props);
      return defaultInitials(name, this.props);
    }
  }, {
    key: "getValue",
    value: function getValue() {
      if (this.props.name) return this.getInitials();
      if (this.props.value) return this.props.value;
      return null;
    }
  }, {
    key: "getColor",
    value: function getColor() {
      var _this$props2 = this.props,
          color = _this$props2.color,
          colors = _this$props2.colors,
          name = _this$props2.name,
          email = _this$props2.email,
          value = _this$props2.value;
      var colorValue = name || email || value;
      return color || getRandomColor(colorValue, colors);
    }
  }]);

  return ValueSource;
}();

_defineProperty(ValueSource, "propTypes", {
  color: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string,
  email: PropTypes.string,
  maxInitials: PropTypes.number,
  initials: PropTypes.oneOfType([PropTypes.string, PropTypes.func])
});

export { ValueSource as default };