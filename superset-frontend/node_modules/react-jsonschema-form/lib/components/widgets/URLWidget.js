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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function URLWidget(props) {
  var BaseInput = props.registry.widgets.BaseInput;

  return _react2.default.createElement(BaseInput, (0, _extends3.default)({ type: "url" }, props));
}

if (process.env.NODE_ENV !== "production") {
  URLWidget.propTypes = {
    value: _propTypes2.default.string
  };
}

exports.default = URLWidget;