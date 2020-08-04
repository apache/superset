"use strict";

exports.__esModule = true;
exports.default = DefaultLegendItemMarkRenderer;

var _react = _interopRequireDefault(require("react"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MARK_WIDTH = 12;
const MARK_HEIGHT = 8;
const MARK_STYLE = {
  display: 'inline-block'
};

function DefaultLegendItemMarkRenderer({
  item
}) {
  var _item$output$stroke, _item$output$strokeWi, _item$output$strokeDa;

  return /*#__PURE__*/_react.default.createElement("svg", {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    style: MARK_STYLE
  }, /*#__PURE__*/_react.default.createElement("line", {
    stroke: (_item$output$stroke = item.output.stroke) != null ? _item$output$stroke : 'none',
    strokeWidth: (_item$output$strokeWi = item.output.strokeWidth) != null ? _item$output$strokeWi : 2,
    strokeDasharray: (_item$output$strokeDa = item.output.strokeDasharray) != null ? _item$output$strokeDa : 'none',
    x1: 0,
    x2: MARK_WIDTH,
    y1: MARK_HEIGHT / 2,
    y2: MARK_HEIGHT / 2
  }));
}