"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require("babel-runtime/helpers/extends");

var _extends3 = _interopRequireDefault(_extends2);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

var _AltDateWidget = require("./AltDateWidget");

var _AltDateWidget2 = _interopRequireDefault(_AltDateWidget);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function AltDateTimeWidget(props) {
  var AltDateWidget = props.registry.widgets.AltDateWidget;

  return _react2.default.createElement(AltDateWidget, (0, _extends3.default)({ time: true }, props));
}

if (process.env.NODE_ENV !== "production") {
  AltDateTimeWidget.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    id: _propTypes2.default.string.isRequired,
    value: _propTypes2.default.string,
    required: _propTypes2.default.bool,
    onChange: _propTypes2.default.func,
    options: _propTypes2.default.object
  };
}

AltDateTimeWidget.defaultProps = (0, _extends3.default)({}, _AltDateWidget2.default.defaultProps, {
  time: true
});

exports.default = AltDateTimeWidget;