"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _propTypes = require("prop-types");

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function UnsupportedField(_ref) {
  var schema = _ref.schema,
      idSchema = _ref.idSchema,
      reason = _ref.reason;

  return _react2.default.createElement(
    "div",
    { className: "unsupported-field" },
    _react2.default.createElement(
      "p",
      null,
      "Unsupported field schema",
      idSchema && idSchema.$id && _react2.default.createElement(
        "span",
        null,
        " for",
        " field ",
        _react2.default.createElement(
          "code",
          null,
          idSchema.$id
        )
      ),
      reason && _react2.default.createElement(
        "em",
        null,
        ": ",
        reason
      ),
      "."
    ),
    schema && _react2.default.createElement(
      "pre",
      null,
      (0, _stringify2.default)(schema, null, 2)
    )
  );
}

if (process.env.NODE_ENV !== "production") {
  UnsupportedField.propTypes = {
    schema: _propTypes2.default.object.isRequired,
    idSchema: _propTypes2.default.object,
    reason: _propTypes2.default.string
  };
}

exports.default = UnsupportedField;