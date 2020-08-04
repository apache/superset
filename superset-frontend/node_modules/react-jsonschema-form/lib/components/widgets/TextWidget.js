"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function TextWidget(props) {
  var BaseInput = props.registry.widgets.BaseInput;

  return _react2.default.createElement(BaseInput, props);
}

if (process.env.NODE_ENV !== "production") {
  TextWidget.propTypes = {
    value: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.number]),
    id: _propTypes2.default.string
  };
}

exports.default = TextWidget;