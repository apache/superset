"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var REQUIRED_FIELD_SYMBOL = "*";

function TitleField(props) {
  var id = props.id,
      title = props.title,
      required = props.required;

  return _react2.default.createElement(
    "legend",
    { id: id },
    title,
    required && _react2.default.createElement(
      "span",
      { className: "required" },
      REQUIRED_FIELD_SYMBOL
    )
  );
}

if (process.env.NODE_ENV !== "production") {
  TitleField.propTypes = {
    id: _propTypes2.default.string,
    title: _propTypes2.default.string,
    required: _propTypes2.default.bool
  };
}

exports.default = TitleField;